import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  approveReconciliationSchema,
  assignDeliverySchema,
  createReconciliationSchema,
  createDeliveryResourceSchema,
  createDeliveryZoneSchema,
  custodyMovementSchema,
  deliveryCaseSchema,
  driverCommandSchema,
  paymentEntrySchema,
  paymentProjectionSchema,
  recordPaymentSchema,
  reconciliationSchema,
  updateDeliveryResourceSchema,
  updateDeliveryZoneSchema,
  type CashPosition,
  type CustodyMovement,
  type DeliveryCase,
  type Money,
  type Order,
  type PaymentEntry,
  type PaymentProjection,
} from '@masaar/contracts';
import { requirePermission } from './auth.js';
import type { AuditRepository } from './audit.js';
import { recordAudit } from './audit.js';
import type { FulfillmentRepository } from './fulfillment-repository.js';
import type { OrderRepository } from './order-repository.js';
import type { CommerceRepository } from './commerce-repository.js';
import type { InventoryRepository } from './inventory-repository.js';
import { applyCustomerOrderTransition } from './customer-stats-service.js';
import { synchronizeOrderInventory } from './inventory-service.js';

const money = (amountMinor: number, currency: 'USD' | 'LBP'): Money => ({ amountMinor, currency });
const now = () => new Date().toISOString();

function resourceCoversZone(
  serviceAreas: string[],
  zone: { name: string; governorates: string[]; areas: string[] },
) {
  const normalize = (value: string) => value.trim().toLowerCase();
  const coverage = [zone.name, ...zone.governorates, ...zone.areas].map(normalize);
  return serviceAreas.some((serviceArea) => {
    const area = normalize(serviceArea);
    if (area === 'lebanon' || area === 'all lebanon' || area === 'nationwide') return true;
    return coverage.some(
      (candidate) => candidate === area || candidate.includes(area) || area.includes(candidate),
    );
  });
}

function paymentProjection(order: Order, entries: PaymentEntry[]): PaymentProjection {
  const related = entries.filter((entry) => entry.orderId === order.id);
  const successful = related.filter((entry) => entry.status === 'POSTED');
  const collectedMinor = successful
    .filter((entry) => entry.type === 'COLLECTION')
    .reduce((sum, entry) => sum + entry.amount.amountMinor, 0);
  const refundedMinor = successful
    .filter((entry) => entry.type === 'REFUND')
    .reduce((sum, entry) => sum + entry.amount.amountMinor, 0);
  const netMinor = collectedMinor - refundedMinor;
  const payableMinor = order.totals.grandTotal.amountMinor;
  const balanceMinor = Math.max(0, payableMinor - netMinor);
  let state: PaymentProjection['state'] = 'PENDING';
  if (related.some((entry) => entry.status === 'FAILED') && collectedMinor === 0) state = 'FAILED';
  if (collectedMinor > 0 && collectedMinor < payableMinor) state = 'PARTIALLY_PAID';
  if (collectedMinor >= payableMinor) state = 'PAID';
  if (refundedMinor > 0 && refundedMinor < collectedMinor) state = 'PARTIALLY_REFUNDED';
  if (refundedMinor > 0 && refundedMinor >= collectedMinor) state = 'REFUNDED';
  return paymentProjectionSchema.parse({
    orderId: order.id,
    orderNumber: order.orderNumber,
    currency: order.currency,
    payable: money(payableMinor, order.currency),
    collected: money(collectedMinor, order.currency),
    refunded: money(refundedMinor, order.currency),
    balance: money(balanceMinor, order.currency),
    state,
    entries: related,
  });
}

export function cashPositions(movements: CustodyMovement[]): CashPosition[] {
  const balances = new Map<
    string,
    {
      holderId: string;
      holderName: string;
      currency: 'USD' | 'LBP';
      amountMinor: number;
      oldestSince: string;
      movementCount: number;
    }
  >();
  const apply = (
    holderId: string | undefined,
    holderName: string | undefined,
    currency: 'USD' | 'LBP',
    amountMinor: number,
    occurredAt: string,
  ) => {
    if (!holderId || !holderName) return;
    const key = `${holderId}:${currency}`;
    const current = balances.get(key) ?? {
      holderId,
      holderName,
      currency,
      amountMinor: 0,
      oldestSince: occurredAt,
      movementCount: 0,
    };
    current.amountMinor += amountMinor;
    current.movementCount += 1;
    if (occurredAt < current.oldestSince) current.oldestSince = occurredAt;
    balances.set(key, current);
  };
  for (const movement of movements) {
    apply(
      movement.fromHolderId,
      movement.fromHolderName,
      movement.amount.currency,
      -movement.amount.amountMinor,
      movement.occurredAt,
    );
    apply(
      movement.toHolderId,
      movement.toHolderName,
      movement.amount.currency,
      movement.amount.amountMinor,
      movement.occurredAt,
    );
  }
  return [...balances.values()]
    .filter((position) => position.amountMinor > 0)
    .map((position) => ({ ...position, amount: money(position.amountMinor, position.currency) }))
    .sort((a, b) => b.amount.amountMinor - a.amount.amountMinor);
}

function orderTimeline(
  order: Order,
  actor: { userId: string; displayName: string },
  action: string,
  message: string,
  status: Order['status'],
) {
  return {
    ...order,
    status,
    assignedUserId:
      status === 'ASSIGNED_TO_DELIVERY' || status === 'OUT_FOR_DELIVERY'
        ? order.assignedUserId
        : order.assignedUserId,
    updatedAt: now(),
    timeline: [
      ...order.timeline,
      {
        id: `evt_${randomUUID()}`,
        actorType: 'USER' as const,
        actorId: actor.userId,
        actorName: actor.displayName,
        action,
        message,
        fromStatus: order.status,
        toStatus: status,
        occurredAt: now(),
      },
    ],
  };
}

async function recordPayment(
  fulfillment: FulfillmentRepository,
  order: Order,
  actorId: string,
  input: ReturnType<typeof recordPaymentSchema.parse>,
): Promise<PaymentEntry> {
  if (input.currency !== order.currency) {
    throw Object.assign(new Error('Payment currency must match the order currency.'), {
      statusCode: 400,
    });
  }
  const timestamp = input.occurredAt;
  const entry = paymentEntrySchema.parse({
    id: `pay_${randomUUID()}`,
    tenantId: order.tenantId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    ...(input.deliveryId ? { deliveryId: input.deliveryId } : {}),
    type: input.type,
    method: input.method,
    status: input.status,
    amount: money(input.amountMinor, input.currency),
    reference: input.reference,
    ...(input.proofUrl ? { proofUrl: input.proofUrl } : {}),
    ...(input.method === 'CASH' && input.holderId
      ? { holderId: input.holderId, holderName: input.holderName ?? input.holderId }
      : {}),
    occurredAt: timestamp,
    createdAt: now(),
    createdBy: actorId,
  });
  await fulfillment.savePaymentEntry(entry);
  if (entry.status === 'POSTED' && entry.method === 'CASH' && entry.holderId && entry.holderName) {
    const collection = entry.type === 'COLLECTION';
    await fulfillment.saveCustodyMovement(
      custodyMovementSchema.parse({
        id: `cash_${randomUUID()}`,
        tenantId: order.tenantId,
        paymentId: entry.id,
        type: collection ? 'DRIVER_COLLECTION' : 'REFUND_PAYOUT',
        amount: entry.amount,
        ...(collection
          ? { toHolderId: entry.holderId, toHolderName: entry.holderName }
          : { fromHolderId: entry.holderId, fromHolderName: entry.holderName }),
        occurredAt: entry.occurredAt,
        actorId,
        note: collection
          ? 'Cash collected and assigned to a holder.'
          : 'Cash refund paid by holder.',
      }),
    );
  }
  return entry;
}

export async function registerFulfillmentRoutes(
  app: FastifyInstance,
  dependencies: {
    fulfillment: FulfillmentRepository;
    orders: OrderRepository;
    audit: AuditRepository;
    commerce: CommerceRepository;
    inventory: InventoryRepository;
  },
) {
  const { fulfillment, orders, audit, commerce, inventory } = dependencies;

  app.get(
    '/api/fulfillment/snapshot',
    { preHandler: requirePermission('payments:read') },
    async (request) => {
      const tenantId = request.session!.tenantId;
      const [allOrders, resources, zones, deliveries, entries, movements, reconciliations] =
        await Promise.all([
          orders.list(tenantId),
          fulfillment.listResources(tenantId),
          fulfillment.listZones(tenantId),
          fulfillment.listDeliveries(tenantId),
          fulfillment.listPaymentEntries(tenantId),
          fulfillment.listCustodyMovements(tenantId),
          fulfillment.listReconciliations(tenantId),
        ]);
      const positions = cashPositions(movements);
      const projections = allOrders.map((order) => paymentProjection(order, entries));
      const today = now().slice(0, 10);
      const todayEntries = entries.filter(
        (entry) => entry.occurredAt.startsWith(today) && entry.status === 'POSTED',
      );
      const aggregateMoney = (values: Money[]) =>
        ['USD', 'LBP']
          .map((currency) =>
            money(
              values
                .filter((value) => value.currency === currency)
                .reduce((sum, value) => sum + value.amountMinor, 0),
              currency as 'USD' | 'LBP',
            ),
          )
          .filter((value) => value.amountMinor > 0);
      const delivered = allOrders.filter(
        (order) => order.status === 'DELIVERED' && order.updatedAt.startsWith(today),
      );
      const methods = ['CASH', 'WHISH', 'OMT', 'CARD', 'BANK', 'OTHER'] as const;
      return {
        resources,
        zones,
        deliveries,
        payments: projections,
        cashPositions: positions,
        reconciliations,
        dailyClose: {
          date: today,
          deliveredOrders: delivered.length,
          deliveredValue: aggregateMoney(delivered.map((order) => order.totals.grandTotal)),
          collectionsByMethod: methods.flatMap((method) =>
            (['USD', 'LBP'] as const)
              .map((currency) => ({
                method,
                amount: money(
                  todayEntries
                    .filter(
                      (entry) =>
                        entry.type === 'COLLECTION' &&
                        entry.method === method &&
                        entry.amount.currency === currency,
                    )
                    .reduce((sum, entry) => sum + entry.amount.amountMinor, 0),
                  currency,
                ),
              }))
              .filter((item) => item.amount.amountMinor > 0),
          ),
          cashPositions: positions,
          unresolvedPayments: projections.filter((projection) =>
            ['PENDING', 'PARTIALLY_PAID', 'FAILED'].includes(projection.state),
          ).length,
          refunds: aggregateMoney(
            todayEntries.filter((entry) => entry.type === 'REFUND').map((entry) => entry.amount),
          ),
          openDiscrepancies: reconciliations.filter((item) => item.status === 'DISCREPANCY_REVIEW')
            .length,
        },
      };
    },
  );

  app.post(
    '/api/fulfillment/resources',
    { preHandler: requirePermission('delivery:write') },
    async (request, reply) => {
      if (!['OWNER', 'MANAGER'].includes(request.session!.role))
        return reply.forbidden('Only an owner or manager can change the delivery network.');
      const input = createDeliveryResourceSchema.parse(request.body);
      const timestamp = now();
      const resource = {
        ...input,
        id: `delivery_resource_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await fulfillment.saveResource(resource);
      await recordAudit(audit, {
        session: request.session!,
        action: 'delivery_resource.created',
        entityType: 'deliveryResource',
        entityId: resource.id,
        correlationId: request.correlationId,
        after: resource,
      });
      return reply.code(201).send(resource);
    },
  );
  app.put(
    '/api/fulfillment/resources/:id',
    { preHandler: requirePermission('delivery:write') },
    async (request, reply) => {
      if (!['OWNER', 'MANAGER'].includes(request.session!.role))
        return reply.forbidden('Only an owner or manager can change the delivery network.');
      const tenantId = request.session!.tenantId;
      const id = (request.params as { id: string }).id;
      const input = updateDeliveryResourceSchema.parse(request.body);
      const existing = (await fulfillment.listResources(tenantId)).find((item) => item.id === id);
      if (!existing) return reply.notFound('Delivery resource not found.');
      const resource = {
        ...existing,
        ...input,
        updatedAt: now(),
      };
      await fulfillment.saveResource(resource);
      await recordAudit(audit, {
        session: request.session!,
        action: 'delivery_resource.updated',
        entityType: 'deliveryResource',
        entityId: resource.id,
        correlationId: request.correlationId,
        before: existing,
        after: resource,
      });
      return resource;
    },
  );

  app.post(
    '/api/fulfillment/zones',
    { preHandler: requirePermission('delivery:write') },
    async (request, reply) => {
      if (!['OWNER', 'MANAGER'].includes(request.session!.role))
        return reply.forbidden('Only an owner or manager can change delivery zones.');
      const input = createDeliveryZoneSchema.parse(request.body);
      const zone = { ...input, id: `zone_${randomUUID()}`, tenantId: request.session!.tenantId };
      await fulfillment.saveZone(zone);
      await recordAudit(audit, {
        session: request.session!,
        action: 'delivery_zone.created',
        entityType: 'deliveryZone',
        entityId: zone.id,
        correlationId: request.correlationId,
        after: zone,
      });
      return reply.code(201).send(zone);
    },
  );
  app.put(
    '/api/fulfillment/zones/:id',
    { preHandler: requirePermission('delivery:write') },
    async (request, reply) => {
      if (!['OWNER', 'MANAGER'].includes(request.session!.role))
        return reply.forbidden('Only an owner or manager can change delivery zones.');
      const tenantId = request.session!.tenantId;
      const id = (request.params as { id: string }).id;
      const input = updateDeliveryZoneSchema.parse(request.body);
      const existing = (await fulfillment.listZones(tenantId)).find((item) => item.id === id);
      if (!existing) return reply.notFound('Delivery zone not found.');
      const zone = { ...existing, ...input };
      await fulfillment.saveZone(zone);
      await recordAudit(audit, {
        session: request.session!,
        action: 'delivery_zone.updated',
        entityType: 'deliveryZone',
        entityId: zone.id,
        correlationId: request.correlationId,
        before: existing,
        after: zone,
      });
      return zone;
    },
  );

  app.post(
    '/api/fulfillment/assignments',
    { preHandler: requirePermission('delivery:write') },
    async (request, reply) => {
      const input = assignDeliverySchema.parse(request.body);
      const tenantId = request.session!.tenantId;
      const [order, resources, zones, existing] = await Promise.all([
        orders.get(tenantId, input.orderId),
        fulfillment.listResources(tenantId),
        fulfillment.listZones(tenantId),
        fulfillment.getDeliveryForOrder(tenantId, input.orderId),
      ]);
      if (!order) return reply.notFound('Order not found.');
      if (!order.deliveryAddress)
        return reply.badRequest('The customer must confirm a delivery address before assignment.');
      if (!['READY_FOR_DISPATCH', 'FAILED'].includes(order.status))
        return reply.conflict('Only ready or failed orders can be assigned for delivery.');
      const resource = resources.find((item) => item.id === input.resourceId && item.active);
      const zone = zones.find((item) => item.id === input.zoneId && item.active);
      if (!resource || !zone)
        return reply.badRequest('Select an active delivery resource and zone.');
      if (!resourceCoversZone(resource.serviceAreas, zone))
        return reply.conflict(
          `${resource.name} does not cover ${zone.name}. Update the partner coverage or choose another delivery resource.`,
        );
      const timestamp = now();
      const attemptNumber = (existing?.attempts.length ?? 0) + 1;
      const delivery = deliveryCaseSchema.parse({
        id: existing?.id ?? `del_${randomUUID()}`,
        tenantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'ASSIGNED',
        resourceId: resource.id,
        resourceName: resource.name,
        resourceType: resource.type,
        zoneId: zone.id,
        zoneName: zone.name,
        customerFee: zone.customerFee,
        businessCost: zone.businessCost,
        expectedCollection: order.totals.amountDue,
        attempts: [
          ...(existing?.attempts ?? []),
          {
            id: `attempt_${randomUUID()}`,
            number: attemptNumber,
            status: 'SCHEDULED',
            scheduledAt: timestamp,
            note: '',
            actorId: request.session!.userId,
          },
        ],
        assignmentHistory: [
          ...(existing?.assignmentHistory ?? []),
          {
            id: `assignment_${randomUUID()}`,
            resourceId: resource.id,
            resourceName: resource.name,
            assignedBy: request.session!.displayName,
            assignedAt: timestamp,
            reason: input.reason,
          },
        ],
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        version: (existing?.version ?? 0) + 1,
      });
      await fulfillment.saveDelivery(delivery);
      const updated = {
        ...orderTimeline(
          order,
          request.session!,
          'delivery.assigned',
          `Assigned to ${resource.name} for ${zone.name}.`,
          'ASSIGNED_TO_DELIVERY',
        ),
        assignedUserId: resource.id,
      };
      await orders.save(updated);
      await recordAudit(audit, {
        session: request.session!,
        action: 'delivery.assigned',
        entityType: 'delivery',
        entityId: delivery.id,
        correlationId: request.correlationId,
        after: delivery,
      });
      return reply.code(201).send(delivery);
    },
  );

  app.get(
    '/api/driver/stops',
    { preHandler: requirePermission('delivery:read') },
    async (request) => {
      const tenantId = request.session!.tenantId;
      const [deliveries, allOrders, entries] = await Promise.all([
        fulfillment.listDeliveries(tenantId),
        orders.list(tenantId),
        fulfillment.listPaymentEntries(tenantId),
      ]);
      const visible =
        request.session!.role === 'DRIVER'
          ? deliveries.filter((delivery) => delivery.resourceId === request.session!.userId)
          : deliveries;
      return visible
        .filter((delivery) => ['ASSIGNED', 'IN_PROGRESS'].includes(delivery.status))
        .flatMap((delivery) => {
          const order = allOrders.find((item) => item.id === delivery.orderId);
          if (!order?.deliveryAddress) return [];
          const projection = paymentProjection(order, entries);
          const address = order.deliveryAddress;
          return [
            {
              delivery,
              customer: {
                name: order.customerName,
                phone: order.customerPhone,
                address: [
                  address.governorate,
                  address.area,
                  address.locality,
                  address.street,
                  address.building,
                  address.floor,
                ]
                  .filter(Boolean)
                  .join(', '),
                ...(address.mapUrl ? { mapUrl: address.mapUrl } : {}),
                notes: order.deliveryNotes,
              },
              order: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
                amountToCollect: projection.balance,
                paymentState: projection.state,
              },
            },
          ];
        });
    },
  );

  app.get(
    '/api/driver/wallet',
    { preHandler: requirePermission('delivery:read') },
    async (request) => {
      const positions = cashPositions(
        await fulfillment.listCustodyMovements(request.session!.tenantId),
      );
      return positions.filter(
        (position) =>
          request.session!.role !== 'DRIVER' || position.holderId === request.session!.userId,
      );
    },
  );

  app.post(
    '/api/driver/commands',
    { preHandler: requirePermission('delivery:write') },
    async (request, reply) => {
      const input = driverCommandSchema.parse(request.body);
      const tenantId = request.session!.tenantId;
      const replay = await fulfillment.getCommandResult(tenantId, input.commandId);
      if (replay) return { ...replay, replayed: true };
      const delivery = await fulfillment.getDelivery(tenantId, input.deliveryId);
      if (!delivery) return reply.notFound('Delivery not found.');
      if (request.session!.role === 'DRIVER' && delivery.resourceId !== request.session!.userId)
        return reply.forbidden('This stop is assigned to another driver.');
      const order = await orders.get(tenantId, delivery.orderId);
      if (!order) return reply.notFound('Order not found.');
      const latest = delivery.attempts.at(-1);
      if (!latest || !['SCHEDULED', 'OUT_FOR_DELIVERY'].includes(latest.status))
        return reply.conflict('This delivery attempt is already closed.');
      if (input.action !== 'OUT_FOR_DELIVERY' && latest.status !== 'OUT_FOR_DELIVERY')
        return reply.conflict('Mark the stop Out for delivery first.');
      if (input.action === 'OUT_FOR_DELIVERY' && latest.status === 'OUT_FOR_DELIVERY')
        return reply.conflict('This stop is already out for delivery.');
      if (input.action === 'DELIVERED' && input.payment && input.payment.amountMinor > 0) {
        const entries = await fulfillment.listPaymentEntries(tenantId);
        const balance = paymentProjection(order, entries).balance.amountMinor;
        if (input.payment.amountMinor > balance) {
          return reply.badRequest('Collected amount cannot exceed the outstanding order balance.');
        }
      }
      const timestamp = input.occurredAt;
      let nextStatus: DeliveryCase['status'];
      let orderStatus: Order['status'];
      if (input.action === 'OUT_FOR_DELIVERY') {
        nextStatus = 'IN_PROGRESS';
        orderStatus = 'OUT_FOR_DELIVERY';
      } else if (input.action === 'DELIVERED') {
        nextStatus = 'COMPLETED';
        orderStatus = 'DELIVERED';
      } else {
        nextStatus = 'FAILED';
        orderStatus = 'FAILED';
      }
      const updatedAttempt = {
        ...latest,
        status: input.action === 'OUT_FOR_DELIVERY' ? ('OUT_FOR_DELIVERY' as const) : input.action,
        ...(input.action === 'OUT_FOR_DELIVERY'
          ? { startedAt: timestamp }
          : { completedAt: timestamp }),
        ...(input.failureReason ? { failureReason: input.failureReason } : {}),
        note: input.note,
        commandId: input.commandId,
        actorId: request.session!.userId,
      };
      const updatedDelivery = deliveryCaseSchema.parse({
        ...delivery,
        status: nextStatus,
        attempts: [...delivery.attempts.slice(0, -1), updatedAttempt],
        updatedAt: timestamp,
        version: delivery.version + 1,
      });
      await fulfillment.saveDelivery(updatedDelivery);
      const updatedOrder = orderTimeline(
        order,
        request.session!,
        `delivery.${input.action.toLowerCase()}`,
        input.action === 'FAILED'
          ? `Delivery failed: ${input.failureReason}. ${input.note}`
          : `Delivery marked ${input.action.toLowerCase().replaceAll('_', ' ')} by ${request.session!.displayName}.`,
        orderStatus,
      );
      await synchronizeOrderInventory(
        updatedOrder,
        await commerce.listProducts(tenantId),
        inventory,
        { userId: request.session!.userId, displayName: request.session!.displayName },
      );
      await orders.save(updatedOrder);
      await applyCustomerOrderTransition(commerce, order, updatedOrder);
      let payment: PaymentEntry | undefined;
      if (input.action === 'DELIVERED' && input.payment && input.payment.amountMinor > 0) {
        payment = await recordPayment(
          fulfillment,
          order,
          request.session!.userId,
          recordPaymentSchema.parse({
            ...input.payment,
            orderId: order.id,
            deliveryId: delivery.id,
            type: 'COLLECTION',
            status: 'POSTED',
            holderId: input.payment.method === 'CASH' ? delivery.resourceId : undefined,
            holderName: input.payment.method === 'CASH' ? delivery.resourceName : undefined,
            occurredAt: timestamp,
          }),
        );
      }
      const result = {
        delivery: updatedDelivery,
        ...(payment ? { payment } : {}),
        orderId: order.id,
      };
      await fulfillment.saveCommandResult(tenantId, input.commandId, result);
      await recordAudit(audit, {
        session: request.session!,
        action: `delivery.${input.action.toLowerCase()}`,
        entityType: 'delivery',
        entityId: delivery.id,
        correlationId: request.correlationId,
        before: delivery,
        after: updatedDelivery,
      });
      return result;
    },
  );

  app.post(
    '/api/payments',
    { preHandler: requirePermission('payments:write') },
    async (request, reply) => {
      const input = recordPaymentSchema.parse(request.body);
      const order = await orders.get(request.session!.tenantId, input.orderId);
      if (!order) return reply.notFound('Order not found.');
      const projection = paymentProjection(
        order,
        await fulfillment.listPaymentEntries(request.session!.tenantId),
      );
      if (
        input.type === 'COLLECTION' &&
        input.status === 'POSTED' &&
        input.amountMinor > projection.balance.amountMinor
      ) {
        return reply.badRequest('Collection cannot exceed the outstanding order balance.');
      }
      if (
        input.type === 'REFUND' &&
        input.status === 'POSTED' &&
        input.amountMinor > projection.collected.amountMinor - projection.refunded.amountMinor
      ) {
        return reply.badRequest('Refund cannot exceed the net amount collected.');
      }
      const entry = await recordPayment(fulfillment, order, request.session!.userId, {
        ...input,
        holderId: input.method === 'CASH' ? (input.holderId ?? request.session!.userId) : undefined,
        holderName:
          input.method === 'CASH' ? (input.holderName ?? request.session!.displayName) : undefined,
      });
      await recordAudit(audit, {
        session: request.session!,
        action: `payment.${entry.type.toLowerCase()}`,
        entityType: 'payment',
        entityId: entry.id,
        correlationId: request.correlationId,
        after: entry,
      });
      return reply.code(201).send(entry);
    },
  );

  app.post(
    '/api/reconciliations',
    { preHandler: requirePermission('payments:write') },
    async (request, reply) => {
      const input = createReconciliationSchema.parse(request.body);
      const movements = await fulfillment.listCustodyMovements(request.session!.tenantId);
      const position = cashPositions(movements).find(
        (item) => item.holderId === input.holderId && item.currency === input.currency,
      );
      const expectedMinor = position?.amount.amountMinor ?? 0;
      const varianceMinor = input.returnedMinor - expectedMinor;
      if (varianceMinor !== 0 && input.explanation.trim().length < 3)
        return reply.badRequest(
          'Explain every shortage or overage before submitting reconciliation.',
        );
      const timestamp = now();
      const cashPayments = (await fulfillment.listPaymentEntries(request.session!.tenantId))
        .filter(
          (entry) =>
            entry.method === 'CASH' &&
            entry.holderId === input.holderId &&
            entry.amount.currency === input.currency &&
            entry.status === 'POSTED',
        )
        .map((entry) => entry.id);
      const reconciliation = reconciliationSchema.parse({
        id: `rec_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        holderId: input.holderId,
        holderName: input.holderName,
        currency: input.currency,
        status: varianceMinor === 0 ? 'MATCHED' : 'DISCREPANCY_REVIEW',
        expected: money(expectedMinor, input.currency),
        returned: money(input.returnedMinor, input.currency),
        remaining: money(Math.max(0, expectedMinor - input.returnedMinor), input.currency),
        variance: money(varianceMinor, input.currency),
        explanation: input.explanation,
        ...(input.evidenceUrl ? { evidenceUrl: input.evidenceUrl } : {}),
        paymentIds: cashPayments,
        createdAt: timestamp,
        createdBy: request.session!.userId,
      });
      await fulfillment.saveReconciliation(reconciliation);
      await recordAudit(audit, {
        session: request.session!,
        action: 'reconciliation.submitted',
        entityType: 'reconciliation',
        entityId: reconciliation.id,
        correlationId: request.correlationId,
        after: reconciliation,
      });
      return reply.code(201).send(reconciliation);
    },
  );

  app.post(
    '/api/reconciliations/:id/approve',
    { preHandler: requirePermission('reconciliation:approve') },
    async (request, reply) => {
      const input = approveReconciliationSchema.parse(request.body);
      const { id } = request.params as { id: string };
      const current = await fulfillment.getReconciliation(request.session!.tenantId, id);
      if (!current) return reply.notFound('Reconciliation not found.');
      if (['APPROVED', 'CLOSED'].includes(current.status))
        return reply.conflict('This reconciliation is already approved.');
      const acceptedMinor = Math.min(current.expected.amountMinor, current.returned.amountMinor);
      if (acceptedMinor > 0)
        await fulfillment.saveCustodyMovement(
          custodyMovementSchema.parse({
            id: `cash_${randomUUID()}`,
            tenantId: current.tenantId,
            reconciliationId: current.id,
            type: 'HANDOVER_ACCEPTED',
            amount: money(acceptedMinor, current.currency),
            fromHolderId: current.holderId,
            fromHolderName: current.holderName,
            toHolderId: 'business_cash',
            toHolderName: 'Business cash',
            occurredAt: now(),
            actorId: request.session!.userId,
            note: input.reason,
          }),
        );
      if (current.returned.amountMinor > current.expected.amountMinor) {
        await fulfillment.saveCustodyMovement(
          custodyMovementSchema.parse({
            id: `cash_${randomUUID()}`,
            tenantId: current.tenantId,
            reconciliationId: current.id,
            type: 'APPROVED_ADJUSTMENT',
            amount: money(
              current.returned.amountMinor - current.expected.amountMinor,
              current.currency,
            ),
            toHolderId: 'business_cash',
            toHolderName: 'Business cash',
            occurredAt: now(),
            actorId: request.session!.userId,
            note: `Approved overage: ${input.reason}`,
          }),
        );
      }
      const timestamp = now();
      const updated = reconciliationSchema.parse({
        ...current,
        status: current.remaining.amountMinor === 0 ? 'CLOSED' : 'APPROVED',
        approvedAt: timestamp,
        approvedBy: request.session!.userId,
        ...(current.remaining.amountMinor === 0 ? { closedAt: timestamp } : {}),
      });
      await fulfillment.saveReconciliation(updated);
      await recordAudit(audit, {
        session: request.session!,
        action: 'reconciliation.approved',
        entityType: 'reconciliation',
        entityId: current.id,
        correlationId: request.correlationId,
        before: current,
        after: updated,
      });
      return updated;
    },
  );
}
