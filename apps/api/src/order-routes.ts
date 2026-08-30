import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  ORDER_TRANSITIONS,
  addOrderNoteSchema,
  addressSchema,
  bulkTransitionSchema,
  customerConfirmationSchema,
  customerSchema,
  messageTemplateRequestSchema,
  orderSchema,
  publicOrderSchema,
  quickOrderSchema,
  transitionOrderSchema,
  updateOrderTagsSchema,
  type Money,
  type Order,
  type OrderStatus,
  custodyMovementSchema,
  paymentEntrySchema,
} from '@masaar/contracts';
import { requirePermission } from './auth.js';
import { normalizeLebanesePhone, type CommerceRepository } from './commerce-repository.js';
import type { AuditRepository } from './audit.js';
import { recordAudit } from './audit.js';
import type { AppConfig } from './config.js';
import type { OrderRepository } from './order-repository.js';
import type { FulfillmentRepository } from './fulfillment-repository.js';
import type { InventoryRepository } from './inventory-repository.js';
import type { BusinessSettingsRepository } from './settings.js';
import { applyCustomerOrderTransition } from './customer-stats-service.js';
import {
  inventoryBalances,
  synchronizeOrderInventory,
  synchronizeTenantInventory,
} from './inventory-service.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const money = (amountMinor: number, currency: 'USD' | 'LBP'): Money => ({ amountMinor, currency });
const variantLabel = (size?: string, color?: string) => [size, color].filter(Boolean).join(' · ');

function nextOrderNumber(existing: Order[]) {
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  const sequence =
    existing.reduce((max, order) => {
      const value = Number(order.orderNumber.split('-').at(-1));
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;
  return `MSR-${date}-${String(sequence).padStart(3, '0')}`;
}

function timelineEvent(
  actor: { id: string; name: string; type?: 'USER' | 'CUSTOMER' | 'SYSTEM' },
  action: string,
  message: string,
  fromStatus?: OrderStatus,
  toStatus?: OrderStatus,
) {
  return {
    id: `evt_${randomUUID()}`,
    actorType: actor.type ?? ('USER' as const),
    actorId: actor.id,
    actorName: actor.name,
    action,
    message,
    ...(fromStatus ? { fromStatus } : {}),
    ...(toStatus ? { toStatus } : {}),
    occurredAt: new Date().toISOString(),
  };
}

function safeOrder(order: Order, businessName: string) {
  return publicOrderSchema.parse({ ...order, businessName });
}

function buildMessage(
  order: Order,
  template: 'CONFIRMATION' | 'REMINDER' | 'STATUS',
  url: string,
  businessName: string,
) {
  if (template === 'CONFIRMATION')
    return `Hi ${order.customerName}, ${businessName} has prepared order ${order.orderNumber}. Please confirm your delivery details securely here: ${url}`;
  if (template === 'REMINDER')
    return `Hi ${order.customerName}, a quick reminder to confirm the delivery details for ${order.orderNumber}: ${url}`;
  return `Hi ${order.customerName}, your order ${order.orderNumber} is now ${order.status.toLowerCase().replaceAll('_', ' ')}. Track the latest status securely here: ${url}. Thank you for ordering from ${businessName}.`;
}

export async function registerOrderRoutes(
  app: FastifyInstance,
  dependencies: {
    orders: OrderRepository;
    commerce: CommerceRepository;
    audit: AuditRepository;
    config: AppConfig;
    fulfillment: FulfillmentRepository;
    inventory: InventoryRepository;
    settings: BusinessSettingsRepository;
  },
) {
  const { orders, commerce, audit, config, fulfillment, inventory, settings } = dependencies;

  app.get('/api/orders', { preHandler: requirePermission('orders:read') }, async (request) => {
    const query = request.query as { search?: string; status?: string };
    const all = await orders.list(request.session!.tenantId);
    const needle = query.search?.trim().toLowerCase();
    return all.filter((order) => {
      const statusMatch = !query.status || order.status === query.status;
      const searchMatch =
        !needle ||
        [
          order.orderNumber,
          order.customerName,
          order.customerPhone,
          ...order.items.flatMap((line) => [line.sku, line.productName]),
        ].some((value) => value.toLowerCase().includes(needle));
      return statusMatch && searchMatch;
    });
  });

  app.post(
    '/api/orders',
    { preHandler: requirePermission('orders:write') },
    async (request, reply) => {
      const input = quickOrderSchema.parse(request.body);
      const tenantId = request.session!.tenantId;
      const normalizedPhone = normalizeLebanesePhone(input.customerPhone);
      const [products, existingOrders, zones] = await Promise.all([
        commerce.listProducts(tenantId),
        orders.list(tenantId),
        fulfillment.listZones(tenantId),
      ]);
      await synchronizeTenantInventory(tenantId, products, existingOrders, inventory);
      const stock = inventoryBalances(await inventory.listMovements(tenantId));
      const selected = input.items.map((requested) => {
        const product = products.find((candidate) =>
          candidate.variants.some((variant) => variant.id === requested.variantId),
        );
        const variant = product?.variants.find((candidate) => candidate.id === requested.variantId);
        if (!product || !variant || !product.active || !variant.available)
          throw app.httpErrors.badRequest(`Variant ${requested.variantId} is not available.`);
        const balance = stock.get(variant.id);
        const available = balance ? balance.onHand - balance.reserved : variant.stockOnHand;
        if (product.trackStock && available !== undefined && requested.quantity > available)
          throw app.httpErrors.badRequest(
            `Only ${available} units of ${variant.sku} are available after confirmed-order reservations.`,
          );
        return { requested, product, variant };
      });
      const currency = selected[0]!.variant.currentSellingPrice.currency;
      if (selected.some(({ variant }) => variant.currentSellingPrice.currency !== currency))
        throw app.httpErrors.badRequest(
          'A single order cannot mix USD and LBP items. Create separate orders or align prices first.',
        );
      const selectedZone = input.deliveryZoneId
        ? zones.find((zone) => zone.id === input.deliveryZoneId && zone.active)
        : undefined;
      if (input.deliveryZoneId && !selectedZone)
        throw app.httpErrors.badRequest('The selected delivery fee zone is unavailable.');
      if (selectedZone && selectedZone.customerFee.currency !== currency)
        throw app.httpErrors.badRequest(
          'The delivery fee zone currency must match the products in this order.',
        );
      const deliveryFeeMinor = selectedZone?.customerFee.amountMinor ?? input.deliveryFeeMinor;

      const recentDuplicate = existingOrders.find(
        (order) =>
          order.customerPhone === normalizedPhone &&
          !['CANCELLED', 'REFUNDED'].includes(order.status) &&
          order.items
            .map((line) => line.variantId)
            .sort()
            .join('|') ===
            input.items
              .map((line) => line.variantId)
              .sort()
              .join('|'),
      );
      if (recentDuplicate && !input.duplicateOverrideReason) {
        return reply.code(409).send({
          error: 'POSSIBLE_DUPLICATE',
          message: `${recentDuplicate.orderNumber} has the same customer and products. Review it or explain why this is a new order.`,
          candidate: {
            id: recentDuplicate.id,
            orderNumber: recentDuplicate.orderNumber,
            status: recentDuplicate.status,
          },
          correlationId: request.correlationId,
        });
      }

      const now = new Date();
      const items = selected.map(({ requested, product, variant }) => ({
        id: `line_${randomUUID()}`,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        variantLabel: variantLabel(variant.size, variant.color),
        quantity: requested.quantity,
        unitPrice: variant.currentSellingPrice,
        unitCost: variant.currentUnitCost,
        lineTotal: money(variant.currentSellingPrice.amountMinor * requested.quantity, currency),
      }));
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal.amountMinor, 0);
      const discount =
        input.discountType === 'PERCENT'
          ? Math.min(subtotal, Math.round((subtotal * Math.min(input.discountValue, 100)) / 100))
          : Math.min(subtotal, input.discountValue);
      const grandTotal = subtotal - discount + deliveryFeeMinor;
      if (input.prepaidMinor > grandTotal)
        throw app.httpErrors.badRequest('Prepaid amount cannot exceed the order total.');
      const token = randomBytes(32).toString('base64url');
      const status: OrderStatus = 'PENDING_CUSTOMER_CONFIRMATION';
      const order = orderSchema.parse({
        id: `ord_${randomUUID()}`,
        tenantId,
        orderNumber: nextOrderNumber(existingOrders),
        source: input.source,
        status,
        customerId: input.customerId,
        customerName: input.customerName,
        customerPhone: normalizedPhone,
        deliveryNotes: '',
        ...(selectedZone ? { deliveryZoneId: selectedZone.id } : {}),
        items,
        currency,
        totals: {
          itemsSubtotal: money(subtotal, currency),
          discount: money(discount, currency),
          deliveryFee: money(deliveryFeeMinor, currency),
          grandTotal: money(grandTotal, currency),
          prepaid: money(input.prepaidMinor, currency),
          amountDue: money(grandTotal - input.prepaidMinor, currency),
        },
        paymentMethod: input.paymentMethod,
        tags: input.tags,
        notes: input.note
          ? [
              {
                id: `note_${randomUUID()}`,
                text: input.note,
                authorId: request.session!.userId,
                authorName: request.session!.displayName,
                createdAt: now.toISOString(),
              },
            ]
          : [],
        timeline: [
          timelineEvent(
            { id: request.session!.userId, name: request.session!.displayName },
            'order.created',
            `Order captured from ${input.source.toLowerCase()}; totals calculated by Masaar.`,
            undefined,
            status,
          ),
        ],
        messages: [],
        confirmationExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        duplicateOverrideReason: input.duplicateOverrideReason,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: request.session!.userId,
      });
      await orders.save(order, hashToken(token));
      if (input.prepaidMinor > 0) {
        const payment = paymentEntrySchema.parse({
          id: `pay_${randomUUID()}`,
          tenantId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          type: 'COLLECTION',
          method: input.paymentMethod,
          status: 'POSTED',
          amount: money(input.prepaidMinor, currency),
          reference: 'Prepaid during order capture',
          ...(input.paymentMethod === 'CASH'
            ? { holderId: request.session!.userId, holderName: request.session!.displayName }
            : {}),
          occurredAt: now.toISOString(),
          createdAt: now.toISOString(),
          createdBy: request.session!.userId,
        });
        await fulfillment.savePaymentEntry(payment);
        if (input.paymentMethod === 'CASH') {
          await fulfillment.saveCustodyMovement(
            custodyMovementSchema.parse({
              id: `cash_${randomUUID()}`,
              tenantId,
              paymentId: payment.id,
              type: 'CASH_COLLECTION',
              amount: payment.amount,
              toHolderId: request.session!.userId,
              toHolderName: request.session!.displayName,
              occurredAt: now.toISOString(),
              actorId: request.session!.userId,
              note: 'Cash prepayment recorded during order capture.',
            }),
          );
        }
      }
      await recordAudit(audit, {
        session: request.session!,
        action: 'order.created',
        entityType: 'order',
        entityId: order.id,
        correlationId: request.correlationId,
        ...(input.duplicateOverrideReason ? { reason: input.duplicateOverrideReason } : {}),
        after: order,
      });
      return reply.code(201).send({
        order,
        confirmationToken: token,
        confirmationUrl: `${config.WEB_ORIGIN}/confirm/${token}`,
      });
    },
  );

  app.post(
    '/api/orders/bulk-transition',
    { preHandler: requirePermission('orders:write') },
    async (request, reply) => {
      const input = bulkTransitionSchema.parse(request.body);
      const changed: Order[] = [];
      const candidates = (
        await Promise.all(input.orderIds.map((id) => orders.get(request.session!.tenantId, id)))
      ).filter((order): order is Order => Boolean(order));
      if (candidates.length !== input.orderIds.length)
        return reply.notFound(
          'One or more selected orders no longer exist. Refresh and try again.',
        );
      const invalid = candidates.find(
        (order) => !ORDER_TRANSITIONS[order.status].includes(input.status),
      );
      if (invalid)
        return reply.code(409).send({
          error: 'ILLEGAL_TRANSITION',
          message: `${invalid.orderNumber} cannot move from ${invalid.status} to ${input.status}.`,
        });
      for (const order of candidates) {
        const before = order.status;
        const updated = orderSchema.parse({
          ...order,
          status: input.status,
          updatedAt: new Date().toISOString(),
          timeline: [
            ...order.timeline,
            timelineEvent(
              { id: request.session!.userId, name: request.session!.displayName },
              'order.bulk_transitioned',
              input.reason,
              before,
              input.status,
            ),
          ],
        });
        await synchronizeOrderInventory(
          updated,
          await commerce.listProducts(request.session!.tenantId),
          inventory,
          { userId: request.session!.userId, displayName: request.session!.displayName },
        );
        await orders.save(updated);
        await applyCustomerOrderTransition(commerce, order, updated);
        await recordAudit(audit, {
          session: request.session!,
          action: 'order.bulk_transitioned',
          entityType: 'order',
          entityId: order.id,
          correlationId: request.correlationId,
          reason: input.reason,
          before: { status: before },
          after: { status: updated.status },
        });
        changed.push(updated);
      }
      return changed;
    },
  );

  app.get(
    '/api/orders/:id',
    { preHandler: requirePermission('orders:read') },
    async (request, reply) => {
      const order = await orders.get(
        request.session!.tenantId,
        (request.params as { id: string }).id,
      );
      return order ?? reply.notFound('Order not found.');
    },
  );

  app.post(
    '/api/orders/:id/transition',
    { preHandler: requirePermission('orders:write') },
    async (request, reply) => {
      const input = transitionOrderSchema.parse(request.body);
      const order = await orders.get(
        request.session!.tenantId,
        (request.params as { id: string }).id,
      );
      if (!order) return reply.notFound('Order not found.');
      if (!ORDER_TRANSITIONS[order.status].includes(input.status))
        return reply.code(409).send({
          error: 'ILLEGAL_TRANSITION',
          message: `${order.orderNumber} cannot move from ${order.status} to ${input.status}.`,
        });
      const updated = orderSchema.parse({
        ...order,
        status: input.status,
        updatedAt: new Date().toISOString(),
        timeline: [
          ...order.timeline,
          timelineEvent(
            { id: request.session!.userId, name: request.session!.displayName },
            'order.status_changed',
            input.reason || `Moved to ${input.status.toLowerCase().replaceAll('_', ' ')}.`,
            order.status,
            input.status,
          ),
        ],
      });
      await synchronizeOrderInventory(
        updated,
        await commerce.listProducts(request.session!.tenantId),
        inventory,
        { userId: request.session!.userId, displayName: request.session!.displayName },
      );
      await orders.save(updated);
      await applyCustomerOrderTransition(commerce, order, updated);
      await recordAudit(audit, {
        session: request.session!,
        action: 'order.status_changed',
        entityType: 'order',
        entityId: order.id,
        correlationId: request.correlationId,
        reason: input.reason,
        before: { status: order.status },
        after: { status: updated.status },
      });
      return updated;
    },
  );

  app.post(
    '/api/orders/:id/notes',
    { preHandler: requirePermission('orders:write') },
    async (request, reply) => {
      const input = addOrderNoteSchema.parse(request.body);
      const order = await orders.get(
        request.session!.tenantId,
        (request.params as { id: string }).id,
      );
      if (!order) return reply.notFound('Order not found.');
      const now = new Date().toISOString();
      const updated = orderSchema.parse({
        ...order,
        updatedAt: now,
        notes: [
          ...order.notes,
          {
            id: `note_${randomUUID()}`,
            text: input.text,
            authorId: request.session!.userId,
            authorName: request.session!.displayName,
            createdAt: now,
          },
        ],
        timeline: [
          ...order.timeline,
          timelineEvent(
            { id: request.session!.userId, name: request.session!.displayName },
            'order.note_added',
            'Internal note added.',
          ),
        ],
      });
      await orders.save(updated);
      return updated;
    },
  );

  app.put(
    '/api/orders/:id/tags',
    { preHandler: requirePermission('orders:write') },
    async (request, reply) => {
      const input = updateOrderTagsSchema.parse(request.body);
      const order = await orders.get(
        request.session!.tenantId,
        (request.params as { id: string }).id,
      );
      if (!order) return reply.notFound('Order not found.');
      const updated = orderSchema.parse({
        ...order,
        tags: input.tags,
        updatedAt: new Date().toISOString(),
        timeline: [
          ...order.timeline,
          timelineEvent(
            { id: request.session!.userId, name: request.session!.displayName },
            'order.tags_updated',
            `Tags updated: ${input.tags.join(', ') || 'none'}.`,
          ),
        ],
      });
      await orders.save(updated);
      return updated;
    },
  );

  app.post(
    '/api/orders/:id/message-template',
    { preHandler: requirePermission('orders:write') },
    async (request, reply) => {
      const input = messageTemplateRequestSchema.parse(request.body);
      const order = await orders.get(
        request.session!.tenantId,
        (request.params as { id: string }).id,
      );
      if (!order) return reply.notFound('Order not found.');
      const token = randomBytes(32).toString('base64url');
      const url = `${config.WEB_ORIGIN}/confirm/${token}`;
      const businessName =
        (await settings.get(request.session!.tenantId))?.businessName ?? 'Cedar & Thread';
      const text = buildMessage(order, input.template, url, businessName);
      const history = {
        id: `msg_${randomUUID()}`,
        template: input.template,
        channel: 'WHATSAPP' as const,
        text,
        copiedBy: request.session!.displayName,
        copiedAt: new Date().toISOString(),
      };
      const updated = orderSchema.parse({
        ...order,
        messages: [...order.messages, history],
        confirmationExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: history.copiedAt,
        timeline: [
          ...order.timeline,
          timelineEvent(
            { id: request.session!.userId, name: request.session!.displayName },
            'order.message_copied',
            `${input.template.toLowerCase()} WhatsApp template copied.`,
          ),
        ],
      });
      await orders.save(updated, hashToken(token));
      return { text, trackingUrl: url, order: updated };
    },
  );

  app.get('/api/public/confirm/:token', async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const order = await orders.findByConfirmationHash(hashToken(token));
    if (!order) return reply.notFound('This confirmation link is invalid.');
    if (Date.parse(order.confirmationExpiresAt) < Date.now())
      return reply.code(410).send({
        error: 'LINK_EXPIRED',
        message: 'This confirmation link has expired. Ask the business for a new link.',
      });
    const businessName = (await settings.get(order.tenantId))?.businessName ?? 'Cedar & Thread';
    return safeOrder(order, businessName);
  });

  app.post('/api/public/confirm/:token', async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const input = customerConfirmationSchema.parse(request.body);
    const order = await orders.findByConfirmationHash(hashToken(token));
    if (!order) return reply.notFound('This confirmation link is invalid.');
    if (Date.parse(order.confirmationExpiresAt) < Date.now())
      return reply
        .code(410)
        .send({ error: 'LINK_EXPIRED', message: 'This confirmation link has expired.' });
    const businessName = (await settings.get(order.tenantId))?.businessName ?? 'Cedar & Thread';
    if (order.status !== 'PENDING_CUSTOMER_CONFIRMATION') return safeOrder(order, businessName);
    const normalizedPhone = normalizeLebanesePhone(input.phone);
    const address = addressSchema.parse({
      id: `addr_${randomUUID()}`,
      label: 'Delivery',
      governorate: input.governorate,
      area: input.area,
      locality: input.locality,
      street: input.street,
      building: input.building,
      floor: input.floor,
      landmark: input.landmark,
      ...(input.mapUrl ? { mapUrl: input.mapUrl } : {}),
      originalWording: [input.locality, input.street, input.building, input.floor, input.landmark]
        .filter(Boolean)
        .join(', '),
    });
    const customers = await commerce.listCustomers(order.tenantId);
    const now = new Date().toISOString();
    let customer = customers.find((candidate) => candidate.phoneNormalized === normalizedPhone);
    if (!customer) {
      customer = customerSchema.parse({
        id: `cus_${randomUUID()}`,
        tenantId: order.tenantId,
        name: input.name,
        phoneOriginal: input.phone,
        phoneNormalized: normalizedPhone,
        preferredPaymentMethod: order.paymentMethod,
        addresses: [address],
        orderStats: {
          completedOrders: 0,
          cancelledOrders: 0,
          failedDeliveries: 0,
          lifetimeSpendUsdMinor: 0,
          lastOrderAt: now,
        },
        tags: [],
        notes: '',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const addressKey = (value: typeof address) =>
        [
          value.governorate,
          value.area,
          value.locality,
          value.street,
          value.building,
          value.floor,
          value.landmark,
        ]
          .join('|')
          .toLowerCase();
      customer = customerSchema.parse({
        ...customer,
        name: input.name,
        phoneOriginal: input.phone,
        preferredPaymentMethod: order.paymentMethod,
        addresses: customer.addresses.some((saved) => addressKey(saved) === addressKey(address))
          ? customer.addresses
          : [...customer.addresses, address],
        orderStats: { ...customer.orderStats, lastOrderAt: now },
        updatedAt: now,
      });
    }
    await commerce.saveCustomer(customer);
    const updated = orderSchema.parse({
      ...order,
      customerId: customer.id,
      customerName: input.name,
      customerPhone: normalizedPhone,
      deliveryAddress: address,
      deliveryNotes: input.deliveryNotes,
      status: 'CONFIRMED',
      confirmedAt: now,
      updatedAt: now,
      timeline: [
        ...order.timeline,
        timelineEvent(
          { id: customer.id, name: input.name, type: 'CUSTOMER' },
          'order.customer_confirmed',
          'Customer confirmed contact and structured delivery details.',
          order.status,
          'CONFIRMED',
        ),
      ],
    });
    await synchronizeOrderInventory(
      updated,
      await commerce.listProducts(order.tenantId),
      inventory,
      { userId: customer.id, displayName: input.name },
    );
    await orders.save(updated);
    return safeOrder(updated, businessName);
  });
}
