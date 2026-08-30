import type { FastifyInstance } from 'fastify';
import { assistantRequestSchema, intelligencePeriodSchema } from '@masaar/contracts';
import { requirePermission } from './auth.js';
import type { CommerceRepository } from './commerce-repository.js';
import { cashPositions } from './fulfillment-routes.js';
import type { FulfillmentRepository } from './fulfillment-repository.js';
import { buildIntelligenceSnapshot } from './intelligence-service.js';
import { buildSnapshot } from './inventory-routes.js';
import type { InventoryRepository } from './inventory-repository.js';
import type { OrderRepository } from './order-repository.js';
import { answerGroundedQuestion, buildPredictiveSnapshot } from './predictive-service.js';

export async function registerPredictiveRoutes(
  app: FastifyInstance,
  dependencies: {
    commerce: CommerceRepository;
    orders: OrderRepository;
    fulfillment: FulfillmentRepository;
    inventory: InventoryRepository;
  },
) {
  async function load(tenantId: string, period: '7D' | '30D' | '90D') {
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
    const intelligence = buildIntelligenceSnapshot({
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
    const predictive = buildPredictiveSnapshot({
      intelligence,
      inventoryItems: inventory.items,
      customers,
    });
    return { intelligence, predictive };
  }

  app.get(
    '/api/predictive/snapshot',
    { preHandler: requirePermission('analytics:read') },
    async (request) => {
      const query = request.query as { period?: string };
      const period = intelligencePeriodSchema.catch('30D').parse(query.period);
      return (await load(request.session!.tenantId, period)).predictive;
    },
  );

  app.post(
    '/api/predictive/assistant',
    { preHandler: requirePermission('analytics:read') },
    async (request) => {
      const input = assistantRequestSchema.parse(request.body);
      const result = await load(request.session!.tenantId, input.period);
      return answerGroundedQuestion(input.question, result.predictive, result.intelligence);
    },
  );
}
