import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { ZodError } from 'zod';
import {
  actionCardSchema,
  businessSettingsSchema,
  notificationSchema,
  roleSchema,
  updateBusinessSettingsSchema,
} from '@masaar/contracts';
import { loadConfig, type AppConfig } from './config.js';
import {
  listTeam,
  provisionMember,
  registerAuth,
  resetMemberPassword,
  requirePermission,
  requireSession,
} from './auth.js';
import { InMemoryAuditRepository, recordAudit, type AuditRepository } from './audit.js';
import {
  defaultBusinessSettings,
  InMemoryBusinessSettingsRepository,
  type BusinessSettingsRepository,
} from './settings.js';
import { InMemoryCommerceRepository, type CommerceRepository } from './commerce-repository.js';
import { registerCommerceRoutes } from './commerce-routes.js';
import { InMemoryOrderRepository, type OrderRepository } from './order-repository.js';
import { registerOrderRoutes } from './order-routes.js';
import {
  InMemoryFulfillmentRepository,
  type FulfillmentRepository,
} from './fulfillment-repository.js';
import { registerFulfillmentRoutes } from './fulfillment-routes.js';
import {
  InMemoryNotificationStateRepository,
  type NotificationStateRepository,
} from './notification-repository.js';
import { InMemoryInventoryRepository, type InventoryRepository } from './inventory-repository.js';
import { registerInventoryRoutes } from './inventory-routes.js';
import { inventoryBalances, synchronizeTenantInventory } from './inventory-service.js';
import { registerIntelligenceRoutes } from './intelligence-routes.js';
import { registerPredictiveRoutes } from './predictive-routes.js';
import { InMemoryExpansionRepository, type ExpansionRepository } from './expansion-repository.js';
import { registerExpansionRoutes } from './expansion-routes.js';

export async function buildApp(options?: {
  config?: AppConfig;
  auditRepository?: AuditRepository;
  settingsRepository?: BusinessSettingsRepository;
  commerceRepository?: CommerceRepository;
  orderRepository?: OrderRepository;
  fulfillmentRepository?: FulfillmentRepository;
  notificationRepository?: NotificationStateRepository;
  inventoryRepository?: InventoryRepository;
  expansionRepository?: ExpansionRepository;
}) {
  const config = options?.config ?? loadConfig();
  const auditRepository = options?.auditRepository ?? new InMemoryAuditRepository();
  const settingsRepository =
    options?.settingsRepository ?? new InMemoryBusinessSettingsRepository();
  const commerceRepository = options?.commerceRepository ?? new InMemoryCommerceRepository();
  const orderRepository = options?.orderRepository ?? new InMemoryOrderRepository();
  const fulfillmentRepository =
    options?.fulfillmentRepository ?? new InMemoryFulfillmentRepository();
  const notificationRepository =
    options?.notificationRepository ?? new InMemoryNotificationStateRepository();
  const inventoryRepository = options?.inventoryRepository ?? new InMemoryInventoryRepository();
  const expansionRepository = options?.expansionRepository ?? new InMemoryExpansionRepository();
  const app = Fastify({ logger: config.MAASAR_ENV !== 'test' });

  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(sensible);
  await registerAuth(app, config, settingsRepository, fulfillmentRepository);

  app.get('/health', async () => ({
    status: 'ok' as const,
    service: 'masaar-api' as const,
    environment: config.MAASAR_ENV,
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/session', { preHandler: requireSession }, async (request) => request.session);

  app.get('/api/audit', { preHandler: requirePermission('audit:read') }, async (request) =>
    auditRepository.listForTenant(request.session!.tenantId),
  );

  app.post(
    '/api/admin/invitations',
    { preHandler: requirePermission('users:manage') },
    async (request, reply) => {
      const body = request.body as {
        email?: string;
        role?: string;
        displayName?: string;
        phone?: string;
      };
      const role = roleSchema.safeParse(body.role);
      if (!body.email || !role.success || role.data === 'OWNER')
        return reply.badRequest('A valid email and non-owner role are required.');
      const displayName = body.displayName?.trim() || body.email.split('@')[0] || 'Invited user';
      const invitationId = `inv_${randomUUID()}`;
      const temporaryPassword = `Masaar-${randomUUID().slice(0, 8)}`;
      const { identity } = await provisionMember(config, {
        tenantId: request.session!.tenantId,
        displayName,
        email: body.email,
        role: role.data,
        password: temporaryPassword,
        ...(body.phone?.trim() ? { phone: body.phone.trim() } : {}),
        requireEmailProof: config.AUTH_MODE === 'cognito',
      });
      if (role.data === 'DRIVER') {
        const timestamp = new Date().toISOString();
        await fulfillmentRepository.saveResource({
          id: identity.userId,
          tenantId: request.session!.tenantId,
          name: identity.displayName,
          type: 'INTERNAL_DRIVER',
          phone: body.phone?.trim() || '+96170000000',
          active: true,
          serviceAreas: ['Lebanon'],
          settlementTerms: 'Daily cash handover',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
      await recordAudit(auditRepository, {
        session: request.session!,
        action: 'membership.invitation_created',
        entityType: 'membershipInvitation',
        entityId: invitationId,
        correlationId: request.correlationId,
        after: { email: body.email, role: role.data },
      });
      return reply.code(201).send({
        member: {
          id: identity.userId,
          tenantId: request.session!.tenantId,
          email: identity.email,
          displayName: identity.displayName,
          role: identity.role,
          status: config.AUTH_MODE === 'cognito' ? 'INVITED' : 'ACTIVE',
          createdAt: identity.createdAt,
        },
        ...(config.AUTH_MODE === 'dev' ? { temporaryPassword } : {}),
        delivery: config.AUTH_MODE === 'cognito' ? 'EMAIL' : 'DEVELOPMENT',
      });
    },
  );

  app.get('/api/admin/team', { preHandler: requirePermission('users:manage') }, async (request) =>
    listTeam(config, request.session!.tenantId),
  );

  app.post(
    '/api/admin/team/reset-password',
    { preHandler: requirePermission('users:manage') },
    async (request, reply) => {
      const email = String((request.body as { email?: unknown })?.email ?? '').trim().toLowerCase();
      const member = (await listTeam(config, request.session!.tenantId)).find(
        (item) => item.email.toLowerCase() === email,
      );
      if (!member) return reply.notFound('Team member not found in this business.');
      const result = await resetMemberPassword(config, email);
      await recordAudit(auditRepository, {
        session: request.session!,
        action: 'membership.password_reset_requested',
        entityType: 'teamMember',
        entityId: member.id,
        correlationId: request.correlationId,
        after: { email, delivery: result.sent ? 'EMAIL' : 'DEVELOPMENT' },
      });
      return result;
    },
  );

  app.get('/api/foundation/settings', { preHandler: requireSession }, async (request) => {
    const current = await settingsRepository.get(request.session!.tenantId);
    return current ?? defaultBusinessSettings(request.session!.tenantId, request.session!.userId);
  });

  app.put(
    '/api/foundation/settings',
    { preHandler: requirePermission('business:manage') },
    async (request) => {
      const update = updateBusinessSettingsSchema.parse(request.body);
      const before = await settingsRepository.get(request.session!.tenantId);
      const after = businessSettingsSchema.parse({
        ...update,
        tenantId: request.session!.tenantId,
        timezone: 'Asia/Beirut',
        updatedAt: new Date().toISOString(),
        updatedBy: request.session!.userId,
      });
      await settingsRepository.put(after);
      await recordAudit(auditRepository, {
        session: request.session!,
        action: 'business.settings_updated',
        entityType: 'businessSettings',
        entityId: request.session!.tenantId,
        correlationId: request.correlationId,
        ...(before ? { before } : {}),
        after,
      });
      return after;
    },
  );

  app.get('/api/foundation/action-cards', { preHandler: requireSession }, async (request) => {
    const [products, fxSnapshots] = await Promise.all([
      commerceRepository.listProducts(request.session!.tenantId),
      commerceRepository.listFxSnapshots(request.session!.tenantId),
    ]);
    const lowStock = products
      .flatMap((product) => product.variants.map((variant) => ({ product: product.name, variant })))
      .filter(({ variant }) => variant.stockOnHand !== undefined && variant.stockOnHand <= 3);
    const lbpVariants = products
      .flatMap((product) => product.variants)
      .filter((variant) => variant.currentSellingPrice.currency === 'LBP');
    return [
      actionCardSchema.parse({
        id: 'commerce-low-stock',
        severity: 'warning',
        title: lowStock.length
          ? `${lowStock[0]!.product} is nearly out of stock`
          : 'Stock levels look healthy',
        explanation: lowStock.length
          ? `${lowStock[0]!.variant.sku} has only ${lowStock[0]!.variant.stockOnHand} units available.`
          : 'No tracked variant is currently at or below three units.',
        impact: `${lowStock.length} low-stock variant${lowStock.length === 1 ? '' : 's'}`,
        action: 'Open catalog',
      }),
      actionCardSchema.parse({
        id: 'commerce-fx-snapshot',
        severity: 'opportunity',
        title: 'LBP pricing has an explicit reference',
        explanation: fxSnapshots[0]
          ? `Masaar is using the owner-entered snapshot of ${fxSnapshots[0].lbpPerUsd.toLocaleString()} LBP per USD for ${lbpVariants.length} LBP-priced variant${lbpVariants.length === 1 ? '' : 's'}.`
          : 'Record an owner-approved USD/LBP reference before comparing mixed-currency margins.',
        impact: fxSnapshots[0] ? 'History protected' : 'Reference needed',
        action: 'Open Price Studio',
      }),
    ];
  });

  app.get('/api/notifications', { preHandler: requireSession }, async (request) => {
    const tenantId = request.session!.tenantId;
    const readIds = new Set(
      await notificationRepository.listReadIds(tenantId, request.session!.userId),
    );
    const [products, orders, deliveries, resources, zones, custody, reconciliations] =
      await Promise.all([
        commerceRepository.listProducts(tenantId),
        orderRepository.list(tenantId),
        fulfillmentRepository.listDeliveries(tenantId),
        fulfillmentRepository.listResources(tenantId),
        fulfillmentRepository.listZones(tenantId),
        fulfillmentRepository.listCustodyMovements(tenantId),
        fulfillmentRepository.listReconciliations(tenantId),
      ]);
    await synchronizeTenantInventory(tenantId, products, orders, inventoryRepository);
    const [inventoryMovements, returnCases] = await Promise.all([
      inventoryRepository.listMovements(tenantId),
      inventoryRepository.listReturns(tenantId),
    ]);
    const stockBalances = inventoryBalances(inventoryMovements);
    const now = new Date().toISOString();
    const candidates = [
      ...(products.length === 0
        ? [
            {
              id: 'setup-catalog',
              severity: 'info' as const,
              title: 'Add your first product',
              detail:
                'Orders need a structured product and price before the team can capture sales.',
              target: 'Catalog' as const,
            },
          ]
        : []),
      ...(resources.length === 0 || zones.length === 0
        ? [
            {
              id: 'setup-delivery',
              severity: 'warning' as const,
              title: 'Complete delivery setup',
              detail: 'Add at least one delivery partner and fee zone before dispatching orders.',
              target: 'Business setup' as const,
            },
          ]
        : []),
      ...(() => {
        const count = orders.filter(
          (order) => order.status === 'PENDING_CUSTOMER_CONFIRMATION',
        ).length;
        return count
          ? [
              {
                id: 'orders-confirmation',
                severity: 'warning' as const,
                title: `${count} order${count === 1 ? '' : 's'} waiting on customers`,
                detail: 'Send or resend the secure confirmation link before preparation starts.',
                target: 'Orders' as const,
              },
            ]
          : [];
      })(),
      ...(() => {
        const count = orders.filter((order) => order.status === 'READY_FOR_DISPATCH').length;
        return count
          ? [
              {
                id: 'orders-ready',
                severity: 'info' as const,
                title: `${count} order${count === 1 ? '' : 's'} ready for dispatch`,
                detail: 'Assign a driver or delivery company so responsibility is clear.',
                target: 'Delivery' as const,
              },
            ]
          : [];
      })(),
      ...(() => {
        const count = deliveries.filter((delivery) => delivery.status === 'FAILED').length;
        return count
          ? [
              {
                id: 'delivery-failed',
                severity: 'critical' as const,
                title: `${count} failed delivery attempt${count === 1 ? '' : 's'}`,
                detail:
                  'Review the recorded reason and decide whether to correct, retry, return or cancel.',
                target: 'Delivery' as const,
              },
            ]
          : [];
      })(),
      ...(() => {
        const count = products
          .filter((product) => product.trackStock)
          .flatMap((product) => product.variants)
          .filter((variant) => {
            const balance = stockBalances.get(variant.id);
            return balance !== undefined && balance.onHand - balance.reserved <= 3;
          }).length;
        return count
          ? [
              {
                id: 'stock-low',
                severity: 'warning' as const,
                title: `${count} low-stock variant${count === 1 ? '' : 's'}`,
                detail: 'Review stock before accepting more social-commerce orders.',
                target: 'Stock Control' as const,
              },
            ]
          : [];
      })(),
      ...(() => {
        const count = returnCases.filter((item) => item.status === 'RECEIVED').length;
        return count
          ? [
              {
                id: 'returns-received',
                severity: 'warning' as const,
                title: `${count} received return${count === 1 ? '' : 's'} need resolution`,
                detail: 'Approve the refund or create the controlled replacement order.',
                target: 'Returns' as const,
              },
            ]
          : [];
      })(),
      ...(() => {
        const count = reconciliations.filter((item) => item.status === 'DISCREPANCY_REVIEW').length;
        return count
          ? [
              {
                id: 'cash-discrepancy',
                severity: 'critical' as const,
                title: `${count} ${count === 1 ? 'cash discrepancy' : 'cash discrepancies'} needs approval`,
                detail:
                  'Expected and returned cash differ; read the explanation before accepting custody.',
                target: 'Payments' as const,
              },
            ]
          : [];
      })(),
      ...(() => {
        const amount =
          custody
            .filter((item) => item.toHolderId && item.toHolderId !== 'business_cash')
            .reduce((sum, item) => sum + item.amount.amountMinor, 0) -
          custody
            .filter((item) => item.fromHolderId && item.fromHolderId !== 'business_cash')
            .reduce((sum, item) => sum + item.amount.amountMinor, 0);
        return amount > 0
          ? [
              {
                id: 'cash-outside',
                severity: 'info' as const,
                title: 'Business cash is still outside the register',
                detail: 'A driver or employee holds collected cash awaiting an approved handover.',
                target: 'Payments' as const,
              },
            ]
          : [];
      })(),
    ];
    return candidates.map((item) =>
      notificationSchema.parse({
        ...item,
        read: readIds.has(item.id),
        createdAt: now,
      }),
    );
  });

  app.post('/api/notifications/:id/read', { preHandler: requireSession }, async (request) => {
    const { id } = request.params as { id: string };
    await notificationRepository.markRead(request.session!.tenantId, request.session!.userId, id);
    return { id, read: true };
  });

  await registerCommerceRoutes(app, { commerce: commerceRepository, audit: auditRepository });
  await registerOrderRoutes(app, {
    orders: orderRepository,
    commerce: commerceRepository,
    audit: auditRepository,
    config,
    fulfillment: fulfillmentRepository,
    inventory: inventoryRepository,
    settings: settingsRepository,
  });
  await registerFulfillmentRoutes(app, {
    fulfillment: fulfillmentRepository,
    orders: orderRepository,
    audit: auditRepository,
    commerce: commerceRepository,
    inventory: inventoryRepository,
  });
  await registerInventoryRoutes(app, {
    inventory: inventoryRepository,
    commerce: commerceRepository,
    orders: orderRepository,
    fulfillment: fulfillmentRepository,
    audit: auditRepository,
  });
  await registerIntelligenceRoutes(app, {
    commerce: commerceRepository,
    orders: orderRepository,
    fulfillment: fulfillmentRepository,
    inventory: inventoryRepository,
  });
  await registerPredictiveRoutes(app, {
    commerce: commerceRepository,
    orders: orderRepository,
    fulfillment: fulfillmentRepository,
    inventory: inventoryRepository,
  });
  await registerExpansionRoutes(app, {
    config,
    expansion: expansionRepository,
    commerce: commerceRepository,
    orders: orderRepository,
    fulfillment: fulfillmentRepository,
    audit: auditRepository,
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, correlationId: request.correlationId }, 'request failed');
    const validationError = error instanceof ZodError;
    const statusCode = validationError ? 400 : (error.statusCode ?? 500);
    return reply.code(statusCode).send({
      error: validationError
        ? 'VALIDATION_ERROR'
        : statusCode < 500
          ? 'REQUEST_ERROR'
          : 'INTERNAL_ERROR',
      message: validationError
        ? 'One or more fields are invalid.'
        : statusCode < 500
          ? error.message
          : 'Unexpected server error.',
      ...(validationError ? { details: error.issues } : {}),
      correlationId: request.correlationId,
    });
  });

  return app;
}
