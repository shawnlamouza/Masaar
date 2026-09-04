import type {
  Customer,
  CustodyMovement,
  DeliveryCase,
  DeliveryFailureReason,
  InventoryMovement,
  Order,
  OrderSource,
  PaymentEntry,
  Reconciliation,
  ReturnCase,
} from '@masaar/contracts';
import type { CommerceRepository } from './commerce-repository.js';
import type { FulfillmentRepository } from './fulfillment-repository.js';
import type { InventoryRepository } from './inventory-repository.js';
import type { OrderRepository } from './order-repository.js';

const tenantId = 'tenant_cedar_thread';
const ownerId = '54b88448-0061-7057-89c4-f025787b05e7';
const sources: OrderSource[] = [
  'INSTAGRAM', 'WHATSAPP', 'FACEBOOK', 'TIKTOK', 'WEBSITE', 'PHONE',
];
const finalFailures = new Map<number, DeliveryFailureReason>([
  [21, 'CUSTOMER_UNAVAILABLE'],
  [27, 'INCORRECT_ADDRESS'],
  [29, 'CUSTOMER_UNAVAILABLE'],
]);

type Repositories = {
  commerceRepository: CommerceRepository;
  orderRepository: OrderRepository;
  fulfillmentRepository: FulfillmentRepository;
  inventoryRepository: InventoryRepository;
};

const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' as const });
const iso = (time: number) => new Date(time).toISOString();

/** Creates inspectable, persistent history for the staging demonstration tenant. */
export async function seedPersistentDemoHistory(repositories: Repositories) {
  const commerce = repositories.commerceRepository;
  const orders = repositories.orderRepository;
  const fulfillment = repositories.fulfillmentRepository;
  const inventory = repositories.inventoryRepository;
  const [products, customers, zones, resources, existingOrders] = await Promise.all([
    commerce.listProducts(tenantId),
    commerce.listCustomers(tenantId),
    fulfillment.listZones(tenantId),
    fulfillment.listResources(tenantId),
    orders.list(tenantId),
  ]);
  const variants = products.flatMap((product) =>
    product.variants
      .filter((variant) =>
        variant.currentSellingPrice.currency === 'USD' && variant.currentUnitCost.currency === 'USD',
      )
      .map((variant) => ({ product, variant })),
  );
  const activeCustomers = customers.filter((customer) => customer.addresses.length > 0);
  const company = resources.find((resource) => resource.type === 'COMPANY' && resource.active)
    ?? resources.find((resource) => resource.active);
  if (!variants.length || !activeCustomers.length || !zones.length || !company)
    throw new Error('Products, customers, zones and a delivery resource are required.');

  const existingIds = new Set(existingOrders.map((order) => order.id));
  const cashPayments: PaymentEntry[] = [];
  let created = 0;
  const start = Date.parse('2026-06-14T09:00:00.000Z');

  for (let index = 0; index < 30; index += 1) {
    const sequence = String(index + 1).padStart(3, '0');
    const orderId = `ord_history_${sequence}`;
    if (existingIds.has(orderId)) continue;
    const customer = activeCustomers[index % activeCustomers.length]!;
    const address = customer.addresses[0]!;
    const selected = variants[(index * 3) % variants.length]!;
    const zone = zones.find((item) => item.governorates.includes(address.governorate)) ?? zones[0]!;
    const createdAt = start + index * 65 * 60 * 60 * 1000;
    const assignedAt = createdAt + 2 * 60 * 60 * 1000;
    const completedAt = createdAt + 6 * 60 * 60 * 1000;
    const quantity = index % 6 === 0 ? 2 : 1;
    const itemsTotal = selected.variant.currentSellingPrice.amountMinor * quantity;
    const total = itemsTotal + zone.customerFee.amountMinor;
    const failureReason = finalFailures.get(index);
    const refunded = index === 18;
    const finalStatus: Order['status'] = failureReason
      ? 'FAILED'
      : refunded
        ? 'REFUNDED'
        : 'DELIVERED';
    const orderNumber = `MSR-H${new Date(createdAt).toISOString().slice(2, 10).replaceAll('-', '')}-${sequence}`;
    const lineId = `${orderId}_line`;
    const deliveryId = `del_history_${sequence}`;
    const timeline: Order['timeline'] = [
      {
        id: `${orderId}_created`, actorType: 'USER', actorId: ownerId, actorName: 'Joe',
        action: 'order.created', message: `Order captured from ${sources[index % sources.length]!.toLowerCase()}.`,
        toStatus: 'PENDING_CUSTOMER_CONFIRMATION', occurredAt: iso(createdAt),
      },
      {
        id: `${orderId}_confirmed`, actorType: 'CUSTOMER', actorId: customer.id,
        actorName: customer.name, action: 'order.customer_confirmed',
        message: 'Customer confirmed structured contact and delivery details.',
        fromStatus: 'PENDING_CUSTOMER_CONFIRMATION', toStatus: 'CONFIRMED',
        occurredAt: iso(createdAt + 30 * 60 * 1000),
      },
      {
        id: `${orderId}_prepared`, actorType: 'USER', actorId: ownerId, actorName: 'Joe',
        action: 'order.status_changed', message: 'Order prepared and packed.',
        fromStatus: 'CONFIRMED', toStatus: 'PACKED', occurredAt: iso(createdAt + 90 * 60 * 1000),
      },
      {
        id: `${orderId}_ready`, actorType: 'USER', actorId: ownerId, actorName: 'Joe',
        action: 'order.status_changed', message: 'Parcel ready for dispatch.',
        fromStatus: 'PACKED', toStatus: 'READY_FOR_DISPATCH', occurredAt: iso(assignedAt - 10 * 60 * 1000),
      },
      {
        id: `${orderId}_assigned`, actorType: 'USER', actorId: ownerId, actorName: 'Joe',
        action: 'delivery.assigned', message: `Assigned to ${company.name} for ${zone.name}.`,
        fromStatus: 'READY_FOR_DISPATCH', toStatus: 'ASSIGNED_TO_DELIVERY', occurredAt: iso(assignedAt),
      },
      {
        id: `${orderId}_out`, actorType: 'USER', actorId: company.id, actorName: company.name,
        action: 'delivery.out_for_delivery', message: 'Delivery route started.',
        fromStatus: 'ASSIGNED_TO_DELIVERY', toStatus: 'OUT_FOR_DELIVERY',
        occurredAt: iso(assignedAt + 60 * 60 * 1000),
      },
      {
        id: `${orderId}_closed`, actorType: 'USER', actorId: company.id, actorName: company.name,
        action: failureReason ? 'delivery.failed' : 'delivery.delivered',
        message: failureReason
          ? `Delivery failed: ${failureReason.toLowerCase().replaceAll('_', ' ')}.`
          : 'Delivery completed and evidence recorded.',
        fromStatus: 'OUT_FOR_DELIVERY', toStatus: failureReason ? 'FAILED' : 'DELIVERED',
        occurredAt: iso(completedAt),
      },
      ...(refunded
        ? [{
            id: `${orderId}_refunded`, actorType: 'USER' as const, actorId: ownerId,
            actorName: 'Joe', action: 'return.refunded',
            message: 'Returned item received and refund completed.',
            fromStatus: 'DELIVERED' as const, toStatus: 'REFUNDED' as const,
            occurredAt: iso(completedAt + 2 * 86_400_000),
          }]
        : []),
    ];
    const order: Order = {
      id: orderId,
      tenantId,
      orderNumber,
      source: sources[index % sources.length]!,
      status: finalStatus,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phoneNormalized,
      deliveryAddress: { ...address, id: `${orderId}_address`, label: 'Delivery' },
      deliveryNotes: 'Call before arriving.',
      deliveryZoneId: zone.id,
      items: [{
        id: lineId,
        productId: selected.product.id,
        variantId: selected.variant.id,
        productName: selected.product.name,
        sku: selected.variant.sku,
        variantLabel: [selected.variant.size, selected.variant.color].filter(Boolean).join(' · '),
        quantity,
        unitPrice: selected.variant.currentSellingPrice,
        unitCost: selected.variant.currentUnitCost,
        lineTotal: usd(itemsTotal),
      }],
      currency: 'USD',
      totals: {
        itemsSubtotal: usd(itemsTotal), discount: usd(0), deliveryFee: zone.customerFee,
        grandTotal: usd(total), prepaid: usd(0), amountDue: usd(total),
      },
      paymentMethod: customer.preferredPaymentMethod,
      tags: [index % 4 === 0 ? 'repeat customer' : 'historical sale'],
      notes: [{
        id: `${orderId}_note`, text: 'Persistent demonstration transaction with full source evidence.',
        authorId: ownerId, authorName: 'Joe', createdAt: iso(createdAt),
      }],
      messages: index % 5 === 0 ? [{
        id: `${orderId}_message`, template: 'STATUS', channel: 'WHATSAPP',
        text: `Order ${orderNumber} is ${failureReason ? 'awaiting delivery follow-up' : 'delivered'}.`,
        copiedBy: 'Joe', copiedAt: iso(completedAt),
      }] : [],
      timeline,
      confirmationExpiresAt: iso(createdAt + 7 * 86_400_000),
      confirmedAt: iso(createdAt + 30 * 60 * 1000),
      assignedUserId: company.id,
      createdAt: iso(createdAt),
      updatedAt: refunded ? iso(completedAt + 2 * 86_400_000) : iso(completedAt),
      createdBy: ownerId,
    };
    await orders.save(order);

    const retried = !failureReason && index % 8 === 0;
    const attempts: DeliveryCase['attempts'] = retried
      ? [
          {
            id: `${deliveryId}_attempt_1`, number: 1, status: 'FAILED',
            scheduledAt: iso(assignedAt), startedAt: iso(assignedAt + 60 * 60 * 1000),
            completedAt: iso(assignedAt + 2 * 60 * 60 * 1000),
            failureReason: 'CUSTOMER_UNAVAILABLE', note: 'Customer requested a later retry.',
            commandId: `${deliveryId}-retry`, actorId: company.id,
          },
          {
            id: `${deliveryId}_attempt_2`, number: 2, status: 'DELIVERED',
            scheduledAt: iso(completedAt - 60 * 60 * 1000), startedAt: iso(completedAt - 30 * 60 * 1000),
            completedAt: iso(completedAt), note: 'Delivered on the agreed second attempt.',
            commandId: `${deliveryId}-done`, actorId: company.id,
          },
        ]
      : [{
          id: `${deliveryId}_attempt_1`, number: 1,
          status: failureReason ? 'FAILED' : 'DELIVERED',
          scheduledAt: iso(assignedAt), startedAt: iso(assignedAt + 60 * 60 * 1000),
          completedAt: iso(completedAt), ...(failureReason ? { failureReason } : {}),
          note: failureReason ? 'Reason recorded for owner follow-up.' : 'Delivered on first attempt.',
          commandId: `${deliveryId}-closed`, actorId: company.id,
        }];
    const delivery: DeliveryCase = {
      id: deliveryId, tenantId, orderId, orderNumber,
      status: failureReason ? 'FAILED' : 'COMPLETED',
      resourceId: company.id, resourceName: company.name, resourceType: company.type,
      zoneId: zone.id, zoneName: zone.name, customerFee: zone.customerFee,
      businessCost: zone.businessCost, expectedCollection: usd(total), attempts,
      assignmentHistory: [{
        id: `${deliveryId}_assignment`, resourceId: company.id, resourceName: company.name,
        assignedBy: 'Joe', assignedAt: iso(assignedAt), reason: 'Scheduled historical dispatch',
      }],
      createdAt: iso(assignedAt), updatedAt: iso(completedAt), version: retried ? 2 : 1,
    };
    await fulfillment.saveDelivery(delivery);

    if (!failureReason) {
      const sale: InventoryMovement = {
        id: `mov_history_sale_${sequence}`, tenantId,
        productId: selected.product.id, productName: selected.product.name,
        variantId: selected.variant.id, sku: selected.variant.sku, type: 'SALE',
        quantity, onHandDelta: -quantity, reservedDelta: 0, locationId: 'main',
        sourceType: 'ORDER', sourceId: orderId, reason: `Delivered ${orderNumber}`,
        unitCost: selected.variant.currentUnitCost,
        idempotencyKey: `history:${orderId}:sale`, createdAt: iso(completedAt), createdBy: company.id,
      };
      await inventory.saveMovement(sale);

      if (index % 13 !== 0) {
        const payment: PaymentEntry = {
          id: `pay_history_${sequence}`, tenantId, orderId, orderNumber, deliveryId,
          type: 'COLLECTION', method: customer.preferredPaymentMethod, status: 'POSTED',
          amount: usd(total), reference: `HIST-${sequence}`,
          ...(customer.preferredPaymentMethod === 'CASH'
            ? { holderId: company.id, holderName: company.name }
            : {}),
          occurredAt: iso(completedAt), createdAt: iso(completedAt), createdBy: company.id,
        };
        await fulfillment.savePaymentEntry(payment);
        if (payment.method === 'CASH') {
          cashPayments.push(payment);
          const collection: CustodyMovement = {
            id: `cash_history_${sequence}`, tenantId, paymentId: payment.id,
            type: 'DRIVER_COLLECTION', amount: payment.amount,
            toHolderId: company.id, toHolderName: company.name,
            occurredAt: payment.occurredAt, actorId: company.id,
            note: `Cash collected for ${orderNumber}.`,
          };
          const handover: CustodyMovement = {
            id: `handover_history_${sequence}`, tenantId, paymentId: payment.id,
            reconciliationId: 'rec_history_cash', type: 'HANDOVER_ACCEPTED', amount: payment.amount,
            fromHolderId: company.id, fromHolderName: company.name,
            occurredAt: iso(completedAt + 86_400_000), actorId: ownerId,
            note: `Historical cash handover accepted for ${orderNumber}.`,
          };
          await fulfillment.saveCustodyMovement(collection);
          await fulfillment.saveCustodyMovement(handover);
        }
      }

      if (refunded) {
        const resolvedAt = completedAt + 2 * 86_400_000;
        const returnCase: ReturnCase = {
          id: 'ret_history_019', tenantId, orderId, orderNumber,
          customerName: customer.name, type: 'RETURN', status: 'RESOLVED',
          reason: 'WRONG_SIZE_OR_VARIANT', note: 'Sellable item returned and restocked.',
          items: [{
            orderLineId: lineId, productId: selected.product.id,
            productName: selected.product.name, variantId: selected.variant.id,
            sku: selected.variant.sku, quantity, unitPrice: selected.variant.currentSellingPrice,
            condition: 'SELLABLE', disposition: 'RESTOCK',
          }],
          refundAmount: usd(total), refundMethod: customer.preferredPaymentMethod,
          refundReference: `REF-${sequence}`, createdAt: iso(completedAt + 86_400_000),
          createdBy: ownerId, receivedAt: iso(resolvedAt), receivedBy: ownerId,
          resolvedAt: iso(resolvedAt), resolvedBy: ownerId,
        };
        await inventory.saveReturn(returnCase);
        await inventory.saveMovement({
          id: 'mov_history_return_019', tenantId,
          productId: selected.product.id, productName: selected.product.name,
          variantId: selected.variant.id, sku: selected.variant.sku,
          type: 'CUSTOMER_RETURN', quantity, onHandDelta: quantity, reservedDelta: 0,
          locationId: 'main', sourceType: 'RETURN', sourceId: returnCase.id,
          reason: `Sellable return from ${orderNumber}`, unitCost: selected.variant.currentUnitCost,
          idempotencyKey: `history:${orderId}:return`, createdAt: iso(resolvedAt), createdBy: ownerId,
        });
        await fulfillment.savePaymentEntry({
          id: 'pay_history_refund_019', tenantId, orderId, orderNumber,
          type: 'REFUND', method: customer.preferredPaymentMethod, status: 'POSTED',
          amount: usd(total), reference: `REF-${sequence}`, occurredAt: iso(resolvedAt),
          createdAt: iso(resolvedAt), createdBy: ownerId,
        });
      }
    }
    created += 1;
  }

  if (cashPayments.length) {
    const amount = cashPayments.reduce((sum, payment) => sum + payment.amount.amountMinor, 0);
    const closedAt = '2026-09-01T17:00:00.000Z';
    const reconciliation: Reconciliation = {
      id: 'rec_history_cash', tenantId, holderId: company.id, holderName: company.name,
      currency: 'USD', status: 'CLOSED', expected: usd(amount), returned: usd(amount),
      remaining: usd(0), variance: usd(0), explanation: 'Historical COD manifest matched in full.',
      paymentIds: cashPayments.map((payment) => payment.id), createdAt: closedAt,
      createdBy: ownerId, approvedAt: closedAt, approvedBy: ownerId, closedAt,
    };
    await fulfillment.saveReconciliation(reconciliation);
  }

  const allOrders = await orders.list(tenantId);
  for (const customer of activeCustomers) {
    const history = allOrders.filter((order) =>
      order.customerId === customer.id || order.customerPhone === customer.phoneNormalized,
    );
    if (!history.length) continue;
    const completed = history.filter((order) =>
      ['DELIVERED', 'RETURNED', 'REFUNDED'].includes(order.status),
    );
    const lastOrderAt = history.map((order) => order.updatedAt).sort().at(-1);
    const updated: Customer = {
      ...customer,
      orderStats: {
        completedOrders: completed.length,
        cancelledOrders: history.filter((order) => order.status === 'CANCELLED').length,
        failedDeliveries: history.filter((order) => order.status === 'FAILED').length,
        lifetimeSpendUsdMinor: completed.reduce(
          (sum, order) => sum + (order.status === 'REFUNDED' ? 0 : order.totals.grandTotal.amountMinor),
          0,
        ),
        ...(lastOrderAt ? { lastOrderAt } : {}),
      },
      updatedAt: lastOrderAt ?? customer.updatedAt,
    };
    await commerce.saveCustomer(updated);
  }

  return { ok: true, created, totalPersistentHistory: 30 };
}
