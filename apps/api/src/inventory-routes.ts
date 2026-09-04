import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  adjustStockSchema,
  createReturnCaseSchema,
  custodyMovementSchema,
  inventorySnapshotSchema,
  orderSchema,
  paymentEntrySchema,
  receiveReturnCaseSchema,
  recordStockReceiptSchema,
  resolveReturnCaseSchema,
  returnCaseSchema,
  type Money,
  type Order,
  type Product,
} from '@masaar/contracts';
import { requirePermission } from './auth.js';
import { recordAudit, type AuditRepository } from './audit.js';
import type { CommerceRepository } from './commerce-repository.js';
import type { FulfillmentRepository } from './fulfillment-repository.js';
import type { InventoryRepository } from './inventory-repository.js';
import {
  addInventoryMovement,
  inventoryBalances,
  synchronizeOrderInventory,
  synchronizeTenantInventory,
} from './inventory-service.js';
import type { OrderRepository } from './order-repository.js';

const money = (amountMinor: number, currency: 'USD' | 'LBP'): Money => ({ amountMinor, currency });
const variantLabel = (size?: string, color?: string) => [size, color].filter(Boolean).join(' · ');

function productIndex(products: Product[]) {
  return new Map(
    products.flatMap((product) =>
      product.variants.map((variant) => [variant.id, { product, variant }] as const),
    ),
  );
}

function nextOrderNumber(existing: Order[]) {
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  const sequence =
    existing.reduce((max, order) => {
      const value = Number(order.orderNumber.split('-').at(-1));
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;
  return `MSR-${date}-${String(sequence).padStart(3, '0')}`;
}

export async function buildSnapshot(
  tenantId: string,
  products: Product[],
  suppliers: Awaited<ReturnType<CommerceRepository['listSuppliers']>>,
  orders: Order[],
  inventory: InventoryRepository,
) {
  await synchronizeTenantInventory(tenantId, products, orders, inventory);
  const [movements, returns] = await Promise.all([
    inventory.listMovements(tenantId),
    inventory.listReturns(tenantId),
  ]);
  const balances = inventoryBalances(movements);
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const items = products
    .filter((product) => product.trackStock)
    .flatMap((product) =>
      product.variants.map((variant) => {
        const balance = balances.get(variant.id) ?? { onHand: 0, reserved: 0 };
        const available = balance.onHand - balance.reserved;
        const soldLast30Days = movements
          .filter(
            (movement) =>
              movement.variantId === variant.id &&
              ['SALE', 'EXCHANGE_OUT'].includes(movement.type) &&
              Date.parse(movement.createdAt) >= cutoff,
          )
          .reduce((sum, movement) => sum + movement.quantity, 0);
        const supplier = variant.supplierId ? supplierMap.get(variant.supplierId) : undefined;
        const dailySales = soldLast30Days / 30;
        const stockCoverDays =
          dailySales > 0 ? Math.max(0, Math.round((available / dailySales) * 10) / 10) : null;
        const leadTime = supplier?.leadTimeDays ?? 7;
        const lowStockThreshold = Math.max(3, Math.ceil(dailySales * (leadTime + 3)));
        const targetUnits = Math.ceil(dailySales * (leadTime + 14));
        const suggestedRestockQuantity =
          available <= lowStockThreshold
            ? Math.max(supplier?.minimumOrderQuantity ?? 1, targetUnits - available)
            : 0;
        const state =
          available <= 0
            ? ('OUT' as const)
            : available <= lowStockThreshold
              ? ('LOW' as const)
              : stockCoverDays !== null && stockCoverDays > 90
                ? ('OVERSTOCKED' as const)
                : ('HEALTHY' as const);
        return {
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          sku: variant.sku,
          variantLabel: variantLabel(variant.size, variant.color),
          onHand: balance.onHand,
          reserved: Math.max(0, balance.reserved),
          available,
          lowStockThreshold,
          ...(supplier
            ? {
                supplierId: supplier.id,
                supplierName: supplier.name,
                supplierLeadTimeDays: supplier.leadTimeDays,
              }
            : {}),
          unitCost: variant.currentUnitCost,
          sellingPrice: variant.currentSellingPrice,
          soldLast30Days,
          stockCoverDays,
          suggestedRestockQuantity,
          suggestedRestockCost: money(
            suggestedRestockQuantity * variant.currentUnitCost.amountMinor,
            variant.currentUnitCost.currency,
          ),
          state,
        };
      }),
    )
    .sort((a, b) => {
      const priority = { OUT: 0, LOW: 1, HEALTHY: 2, OVERSTOCKED: 3, UNTRACKED: 4 };
      return priority[a.state] - priority[b.state] || a.productName.localeCompare(b.productName);
    });
  const totals = (field: 'value' | 'restock') =>
    (['USD', 'LBP'] as const)
      .map((currency) => ({
        currency,
        amountMinor: items
          .filter((item) => item.unitCost.currency === currency)
          .reduce(
            (sum, item) =>
              sum +
              (field === 'value'
                ? Math.max(0, item.onHand) * item.unitCost.amountMinor
                : item.suggestedRestockCost.amountMinor),
            0,
          ),
      }))
      .filter((total) => total.amountMinor > 0);
  return inventorySnapshotSchema.parse({
    generatedAt: new Date().toISOString(),
    summary: {
      trackedVariants: items.length,
      unitsOnHand: items.reduce((sum, item) => sum + item.onHand, 0),
      unitsReserved: items.reduce((sum, item) => sum + item.reserved, 0),
      unitsAvailable: items.reduce((sum, item) => sum + item.available, 0),
      lowStockVariants: items.filter((item) => item.state === 'LOW').length,
      outOfStockVariants: items.filter((item) => item.state === 'OUT').length,
      inventoryValueByCurrency: totals('value'),
      suggestedRestockByCurrency: totals('restock'),
    },
    items,
    movements: movements.slice(0, 100),
    returns,
  });
}

export async function registerInventoryRoutes(
  app: FastifyInstance,
  dependencies: {
    inventory: InventoryRepository;
    commerce: CommerceRepository;
    orders: OrderRepository;
    fulfillment: FulfillmentRepository;
    audit: AuditRepository;
  },
) {
  const { inventory, commerce, orders, fulfillment, audit } = dependencies;

  app.get(
    '/api/inventory/snapshot',
    { preHandler: requirePermission('inventory:read') },
    async (request) => {
      const tenantId = request.session!.tenantId;
      const [products, suppliers, tenantOrders] = await Promise.all([
        commerce.listProducts(tenantId),
        commerce.listSuppliers(tenantId),
        orders.list(tenantId),
      ]);
      return buildSnapshot(tenantId, products, suppliers, tenantOrders, inventory);
    },
  );

  app.post(
    '/api/inventory/receipts',
    { preHandler: requirePermission('inventory:write') },
    async (request, reply) => {
      const input = recordStockReceiptSchema.parse(request.body);
      const tenantId = request.session!.tenantId;
      const products = await commerce.listProducts(tenantId);
      const variants = productIndex(products);
      await synchronizeTenantInventory(tenantId, products, await orders.list(tenantId), inventory);
      const receiptId = `receipt_${randomUUID()}`;
      for (const item of input.items) {
        const catalog = variants.get(item.variantId);
        if (!catalog?.product.trackStock)
          return reply.badRequest('Every receipt item must be a tracked catalog variant.');
        if (
          input.supplierId &&
          catalog.variant.supplierId &&
          input.supplierId !== catalog.variant.supplierId
        )
          return reply.badRequest(`${catalog.variant.sku} is linked to a different supplier.`);
        await addInventoryMovement(inventory, {
          tenantId,
          productId: catalog.product.id,
          productName: catalog.product.name,
          variantId: catalog.variant.id,
          sku: catalog.variant.sku,
          type: 'RECEIPT',
          quantity: item.quantity,
          onHandDelta: item.quantity,
          reservedDelta: 0,
          locationId: 'main',
          sourceType: 'RECEIPT',
          sourceId: receiptId,
          reason: `Stock receipt ${input.reference}.`,
          unitCost: item.unitCost ?? catalog.variant.currentUnitCost,
          idempotencyKey: `${receiptId}:${item.variantId}`,
          createdAt: input.receivedAt,
          createdBy: request.session!.userId,
        });
      }
      await recordAudit(audit, {
        session: request.session!,
        action: 'inventory.receipt_recorded',
        entityType: 'stockReceipt',
        entityId: receiptId,
        correlationId: request.correlationId,
        after: input,
      });
      return reply
        .code(201)
        .send(
          await buildSnapshot(
            tenantId,
            products,
            await commerce.listSuppliers(tenantId),
            await orders.list(tenantId),
            inventory,
          ),
        );
    },
  );

  app.post(
    '/api/inventory/adjustments',
    { preHandler: requirePermission('inventory:write') },
    async (request, reply) => {
      if (!['OWNER', 'MANAGER'].includes(request.session!.role))
        return reply.forbidden('Only an owner or manager can approve a stock correction.');
      const input = adjustStockSchema.parse(request.body);
      const tenantId = request.session!.tenantId;
      const products = await commerce.listProducts(tenantId);
      await synchronizeTenantInventory(tenantId, products, await orders.list(tenantId), inventory);
      const catalog = productIndex(products).get(input.variantId);
      if (!catalog?.product.trackStock)
        return reply.badRequest('Choose a tracked catalog variant.');
      const movements = await inventory.listMovements(tenantId);
      const current = inventoryBalances(movements).get(input.variantId)?.onHand ?? 0;
      const delta = input.countedOnHand - current;
      if (delta === 0) return reply.badRequest('The physical count already matches Masaar.');
      const adjustmentId = `adjustment_${randomUUID()}`;
      await addInventoryMovement(inventory, {
        tenantId,
        productId: catalog.product.id,
        productName: catalog.product.name,
        variantId: catalog.variant.id,
        sku: catalog.variant.sku,
        type: 'ADJUSTMENT',
        quantity: Math.abs(delta),
        onHandDelta: delta,
        reservedDelta: 0,
        locationId: 'main',
        sourceType: 'MANUAL',
        sourceId: adjustmentId,
        reason: input.reason,
        unitCost: catalog.variant.currentUnitCost,
        idempotencyKey: adjustmentId,
        createdBy: request.session!.userId,
      });
      await recordAudit(audit, {
        session: request.session!,
        action: 'inventory.adjusted',
        entityType: 'inventoryMovement',
        entityId: adjustmentId,
        correlationId: request.correlationId,
        reason: input.reason,
        before: { onHand: current },
        after: { onHand: input.countedOnHand },
      });
      return reply
        .code(201)
        .send(
          await buildSnapshot(
            tenantId,
            products,
            await commerce.listSuppliers(tenantId),
            await orders.list(tenantId),
            inventory,
          ),
        );
    },
  );

  app.post(
    '/api/returns',
    { preHandler: requirePermission('orders:write') },
    async (request, reply) => {
      const input = createReturnCaseSchema.parse(request.body);
      const order = await orders.get(request.session!.tenantId, input.orderId);
      if (!order) return reply.notFound('Order not found.');
      if (!['DELIVERED', 'FAILED', 'RETURNED'].includes(order.status))
        return reply.conflict('A return can begin only after delivery or a failed delivery.');
      const existing = await inventory.listReturns(order.tenantId);
      const items = input.items.map((requested) => {
        const line = order.items.find((candidate) => candidate.id === requested.orderLineId);
        if (!line)
          throw app.httpErrors.badRequest('A selected item does not belong to this order.');
        const alreadyOpen = existing
          .filter((candidate) => candidate.orderId === order.id && candidate.status !== 'CANCELLED')
          .flatMap((candidate) => candidate.items)
          .filter((candidate) => candidate.orderLineId === line.id)
          .reduce((sum, candidate) => sum + candidate.quantity, 0);
        if (alreadyOpen + requested.quantity > line.quantity)
          throw app.httpErrors.conflict(
            `Only ${line.quantity - alreadyOpen} ${line.sku} unit(s) remain returnable.`,
          );
        if (input.type === 'EXCHANGE' && !requested.replacementVariantId)
          throw app.httpErrors.badRequest('Choose a replacement variant for every exchange item.');
        return {
          orderLineId: line.id,
          productId: line.productId,
          productName: line.productName,
          variantId: line.variantId,
          sku: line.sku,
          quantity: requested.quantity,
          unitPrice: line.unitPrice,
          ...(requested.replacementVariantId
            ? { replacementVariantId: requested.replacementVariantId }
            : {}),
        };
      });
      const created = returnCaseSchema.parse({
        id: `ret_${randomUUID()}`,
        tenantId: order.tenantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        type: input.type,
        status: 'OPEN',
        reason: input.reason,
        note: input.note,
        items,
        createdAt: new Date().toISOString(),
        createdBy: request.session!.userId,
      });
      await inventory.saveReturn(created);
      await recordAudit(audit, {
        session: request.session!,
        action: 'return.opened',
        entityType: 'returnCase',
        entityId: created.id,
        correlationId: request.correlationId,
        after: created,
      });
      return reply.code(201).send(created);
    },
  );

  app.post(
    '/api/returns/:id/receive',
    { preHandler: requirePermission('inventory:write') },
    async (request, reply) => {
      const input = receiveReturnCaseSchema.parse(request.body);
      const tenantId = request.session!.tenantId;
      const current = await inventory.getReturn(tenantId, (request.params as { id: string }).id);
      if (!current) return reply.notFound('Return case not found.');
      if (current.status !== 'OPEN')
        return reply.conflict('This return was already received or closed.');
      const updatedItems = current.items.map((item) => {
        const received = input.items.find(
          (candidate) => candidate.orderLineId === item.orderLineId,
        );
        if (!received) throw app.httpErrors.badRequest(`Record the condition of ${item.sku}.`);
        return { ...item, condition: received.condition, disposition: received.disposition };
      });
      for (const item of updatedItems) {
        const base = {
          tenantId,
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId,
          sku: item.sku,
          quantity: item.quantity,
          reservedDelta: 0,
          locationId: 'main' as const,
          sourceType: 'RETURN' as const,
          sourceId: current.id,
          createdBy: request.session!.userId,
        };
        if (item.disposition === 'RESTOCK')
          await addInventoryMovement(inventory, {
            ...base,
            type: current.type === 'EXCHANGE' ? 'EXCHANGE_IN' : 'CUSTOMER_RETURN',
            onHandDelta: item.quantity,
            reason: `Sellable item received for ${current.id}.`,
            idempotencyKey: `return:${current.id}:${item.orderLineId}:in`,
          });
        if (item.disposition === 'RETURN_TO_SUPPLIER') {
          await addInventoryMovement(inventory, {
            ...base,
            type: 'CUSTOMER_RETURN',
            onHandDelta: item.quantity,
            reason: `Item received before supplier return for ${current.id}.`,
            idempotencyKey: `return:${current.id}:${item.orderLineId}:in`,
          });
          await addInventoryMovement(inventory, {
            ...base,
            type: 'SUPPLIER_RETURN',
            onHandDelta: -item.quantity,
            reason: `Item separated for supplier return from ${current.id}.`,
            idempotencyKey: `return:${current.id}:${item.orderLineId}:supplier`,
          });
        }
        if (['QUARANTINE', 'DAMAGED_WRITE_OFF'].includes(item.disposition!))
          await addInventoryMovement(inventory, {
            ...base,
            type: 'DAMAGE',
            onHandDelta: 0,
            reason: `${item.condition} item kept outside sellable stock for ${current.id}.`,
            idempotencyKey: `return:${current.id}:${item.orderLineId}:non-sellable`,
          });
      }
      const received = returnCaseSchema.parse({
        ...current,
        items: updatedItems,
        note: [current.note, input.note].filter(Boolean).join(' · '),
        status: 'RECEIVED',
        receivedAt: new Date().toISOString(),
        receivedBy: request.session!.userId,
      });
      await inventory.saveReturn(received);
      await recordAudit(audit, {
        session: request.session!,
        action: 'return.received',
        entityType: 'returnCase',
        entityId: received.id,
        correlationId: request.correlationId,
        before: current,
        after: received,
      });
      return received;
    },
  );

  app.post(
    '/api/returns/:id/resolve',
    { preHandler: requirePermission('payments:write') },
    async (request, reply) => {
      if (!['OWNER', 'MANAGER'].includes(request.session!.role))
        return reply.forbidden('Only an owner or manager can finalize refunds and exchanges.');
      const input = resolveReturnCaseSchema.parse(request.body);
      const tenantId = request.session!.tenantId;
      const current = await inventory.getReturn(tenantId, (request.params as { id: string }).id);
      if (!current) return reply.notFound('Return case not found.');
      if (current.status !== 'RECEIVED')
        return reply.conflict('Receive and inspect the items before resolving this case.');
      const original = await orders.get(tenantId, current.orderId);
      if (!original) return reply.notFound('Original order not found.');
      const returnValue = current.items.reduce(
        (sum, item) => sum + item.unitPrice.amountMinor * item.quantity,
        0,
      );
      if (input.refundAmountMinor > returnValue)
        return reply.badRequest('Refund cannot exceed the value of the returned items.');
      if (input.refundAmountMinor > 0 && !input.refundMethod)
        return reply.badRequest('Choose how the refund was paid.');
      let replacementOrderId: string | undefined;
      if (current.type === 'EXCHANGE') {
        const products = await commerce.listProducts(tenantId);
        const variants = productIndex(products);
        const lines = current.items.map((item) => {
          const replacement = variants.get(item.replacementVariantId!);
          if (!replacement?.product.active || !replacement.variant.available)
            throw app.httpErrors.conflict('A replacement variant is no longer available.');
          return {
            id: `line_${randomUUID()}`,
            productId: replacement.product.id,
            variantId: replacement.variant.id,
            productName: replacement.product.name,
            sku: replacement.variant.sku,
            variantLabel: variantLabel(replacement.variant.size, replacement.variant.color),
            quantity: item.quantity,
            unitPrice: replacement.variant.currentSellingPrice,
            unitCost: replacement.variant.currentUnitCost,
            lineTotal: money(
              replacement.variant.currentSellingPrice.amountMinor * item.quantity,
              replacement.variant.currentSellingPrice.currency,
            ),
          };
        });
        if (lines.some((line) => line.unitPrice.currency !== original.currency))
          return reply.conflict('Replacement items must use the original order currency.');
        const subtotal = lines.reduce((sum, line) => sum + line.lineTotal.amountMinor, 0);
        const credit = Math.min(subtotal, returnValue);
        const timestamp = new Date().toISOString();
        const replacement = orderSchema.parse({
          ...original,
          id: `ord_${randomUUID()}`,
          orderNumber: nextOrderNumber(await orders.list(tenantId)),
          status: 'CONFIRMED',
          items: lines,
          totals: {
            itemsSubtotal: money(subtotal, original.currency),
            discount: money(credit, original.currency),
            deliveryFee: money(0, original.currency),
            grandTotal: money(subtotal - credit, original.currency),
            prepaid: money(0, original.currency),
            amountDue: money(subtotal - credit, original.currency),
          },
          tags: [...new Set([...original.tags, 'exchange', current.id])],
          notes: [
            {
              id: `note_${randomUUID()}`,
              text: `Replacement order for ${original.orderNumber}.`,
              authorId: request.session!.userId,
              authorName: request.session!.displayName,
              createdAt: timestamp,
            },
          ],
          timeline: [
            {
              id: `evt_${randomUUID()}`,
              actorType: 'SYSTEM',
              actorId: request.session!.userId,
              actorName: request.session!.displayName,
              action: 'exchange.replacement_created',
              message: `Replacement created from return case ${current.id}.`,
              toStatus: 'CONFIRMED',
              occurredAt: timestamp,
            },
          ],
          messages: [],
          confirmationExpiresAt: timestamp,
          confirmedAt: timestamp,
          assignedUserId: undefined,
          duplicateOverrideReason: `Replacement for ${original.orderNumber}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: request.session!.userId,
        });
        await synchronizeOrderInventory(replacement, products, inventory, {
          userId: request.session!.userId,
        });
        await orders.save(replacement);
        replacementOrderId = replacement.id;
      }
      if (input.refundAmountMinor > 0) {
        const paid = (await fulfillment.listPaymentEntries(tenantId))
          .filter((entry) => entry.orderId === original.id && entry.status === 'POSTED')
          .reduce(
            (sum, entry) =>
              sum +
              (entry.type === 'COLLECTION' ? entry.amount.amountMinor : -entry.amount.amountMinor),
            0,
          );
        if (input.refundAmountMinor > paid)
          return reply.badRequest('Refund cannot exceed the amount actually collected.');
        const timestamp = new Date().toISOString();
        const payment = paymentEntrySchema.parse({
          id: `pay_${randomUUID()}`,
          tenantId,
          orderId: original.id,
          orderNumber: original.orderNumber,
          type: 'REFUND',
          method: input.refundMethod,
          status: 'POSTED',
          amount: money(input.refundAmountMinor, original.currency),
          reference: input.refundReference || `Return ${current.id}`,
          ...(input.refundMethod === 'CASH'
            ? { holderId: 'business_cash', holderName: 'Business cash register' }
            : {}),
          occurredAt: timestamp,
          createdAt: timestamp,
          createdBy: request.session!.userId,
        });
        await fulfillment.savePaymentEntry(payment);
        if (payment.method === 'CASH')
          await fulfillment.saveCustodyMovement(
            custodyMovementSchema.parse({
              id: `cash_${randomUUID()}`,
              tenantId,
              paymentId: payment.id,
              type: 'REFUND_PAYOUT',
              amount: payment.amount,
              fromHolderId: 'business_cash',
              fromHolderName: 'Business cash register',
              occurredAt: timestamp,
              actorId: request.session!.userId,
              note: `Cash refund for ${current.id}.`,
            }),
          );
      }
      const refundedFully =
        input.refundAmountMinor > 0 &&
        input.refundAmountMinor >= original.totals.grandTotal.amountMinor;
      const updatedOrder = orderSchema.parse({
        ...original,
        status: refundedFully ? 'REFUNDED' : 'RETURNED',
        updatedAt: new Date().toISOString(),
        timeline: [
          ...original.timeline,
          {
            id: `evt_${randomUUID()}`,
            actorType: 'USER',
            actorId: request.session!.userId,
            actorName: request.session!.displayName,
            action: 'return.resolved',
            message: `${current.type === 'EXCHANGE' ? 'Exchange' : 'Return'} ${current.id} resolved${replacementOrderId ? ' with a replacement order' : ''}.`,
            fromStatus: original.status,
            toStatus: refundedFully ? 'REFUNDED' : 'RETURNED',
            occurredAt: new Date().toISOString(),
          },
        ],
      });
      await orders.save(updatedOrder);
      const resolved = returnCaseSchema.parse({
        ...current,
        status: 'RESOLVED',
        ...(input.refundAmountMinor > 0
          ? {
              refundAmount: money(input.refundAmountMinor, original.currency),
              refundMethod: input.refundMethod,
              refundReference: input.refundReference,
            }
          : {}),
        ...(replacementOrderId ? { replacementOrderId } : {}),
        resolvedAt: new Date().toISOString(),
        resolvedBy: request.session!.userId,
      });
      await inventory.saveReturn(resolved);
      await recordAudit(audit, {
        session: request.session!,
        action: 'return.resolved',
        entityType: 'returnCase',
        entityId: resolved.id,
        correlationId: request.correlationId,
        before: current,
        after: resolved,
      });
      return resolved;
    },
  );
}
