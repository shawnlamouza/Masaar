import type { FastifyInstance } from 'fastify';
import { intelligencePeriodSchema } from '@masaar/contracts';
import { requirePermission } from './auth.js';
import type { CommerceRepository } from './commerce-repository.js';
import type { FulfillmentRepository } from './fulfillment-repository.js';
import type { InventoryRepository } from './inventory-repository.js';
import { buildSnapshot } from './inventory-routes.js';
import { cashPositions } from './fulfillment-routes.js';
import type { OrderRepository } from './order-repository.js';
import { buildIntelligenceSnapshot } from './intelligence-service.js';

export async function registerIntelligenceRoutes(
  app: FastifyInstance,
  dependencies: {
    commerce: CommerceRepository;
    orders: OrderRepository;
    fulfillment: FulfillmentRepository;
    inventory: InventoryRepository;
  },
) {
  app.get(
    '/api/intelligence/snapshot',
    { preHandler: requirePermission('analytics:read') },
    async (request) => {
      const tenantId = request.session!.tenantId;
      const query = request.query as { period?: string };
      const period = intelligencePeriodSchema.catch('30D').parse(query.period);
      const [
        orders,
        products,
        suppliers,
        customers,
        deliveries,
        payments,
        custody,
        reconciliations,
        fxSnapshots,
      ] = await Promise.all([
        dependencies.orders.list(tenantId),
        dependencies.commerce.listProducts(tenantId),
        dependencies.commerce.listSuppliers(tenantId),
        dependencies.commerce.listCustomers(tenantId),
        dependencies.fulfillment.listDeliveries(tenantId),
        dependencies.fulfillment.listPaymentEntries(tenantId),
        dependencies.fulfillment.listCustodyMovements(tenantId),
        dependencies.fulfillment.listReconciliations(tenantId),
        dependencies.commerce.listFxSnapshots(tenantId),
      ]);
      const inventory = await buildSnapshot(
        tenantId,
        products,
        suppliers,
        orders,
        dependencies.inventory,
      );
      return buildIntelligenceSnapshot({
        tenantId,
        period,
        orders,
        deliveries,
        payments,
        cashPositions: cashPositions(custody),
        reconciliations,
        inventoryItems: inventory.items,
        returns: inventory.returns,
        customers,
        latestFx: fxSnapshots[0] ?? null,
      });
    },
  );
}
