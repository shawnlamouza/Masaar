import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  adminTaskSchema,
  createAdminTaskSchema,
  expansionSnapshotSchema,
  integrationProviderSchema,
  updateAdminTaskSchema,
  type Customer,
  type CustomerSegment,
  type IntegrationProvider,
  type LaunchCheck,
} from '@masaar/contracts';
import { requirePermission } from './auth.js';
import { recordAudit, type AuditRepository } from './audit.js';
import type { AppConfig } from './config.js';
import type { CommerceRepository } from './commerce-repository.js';
import type { ExpansionRepository } from './expansion-repository.js';
import type { FulfillmentRepository } from './fulfillment-repository.js';
import type { OrderRepository } from './order-repository.js';

function segmentCustomers(customers: Customer[], now = new Date()): CustomerSegment[] {
  const daysSince = (value?: string) =>
    value ? Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000)) : null;
  const definitions: Array<{
    id: CustomerSegment['id'];
    label: string;
    description: string;
    recommendedAction: string;
    matches: (customer: Customer) => boolean;
  }> = [
    {
      id: 'CHAMPIONS',
      label: 'Champions',
      description: 'Frequent customers with strong completed spend and recent activity.',
      recommendedAction: 'Thank them personally and offer early access—not an automatic discount.',
      matches: (customer) =>
        customer.orderStats.completedOrders >= 5 &&
        customer.orderStats.lifetimeSpendUsdMinor >= 20_000 &&
        (daysSince(customer.orderStats.lastOrderAt) ?? 999) <= 60,
    },
    {
      id: 'REPEAT',
      label: 'Repeat customers',
      description: 'Customers with at least two completed orders who are not in Champions.',
      recommendedAction: 'Reuse verified details and suggest products related to prior purchases.',
      matches: (customer) => customer.orderStats.completedOrders >= 2,
    },
    {
      id: 'NEW',
      label: 'New customers',
      description: 'Customers with zero or one completed order.',
      recommendedAction: 'Make confirmation and delivery frictionless; ask permission before follow-up.',
      matches: (customer) => customer.orderStats.completedOrders <= 1,
    },
    {
      id: 'AT_RISK',
      label: 'At-risk regulars',
      description: 'Previously active customers whose last recorded order is more than 90 days old.',
      recommendedAction: 'Send a relevant, human-approved re-engagement message with a clear opt-out.',
      matches: (customer) =>
        customer.orderStats.completedOrders >= 2 &&
        (daysSince(customer.orderStats.lastOrderAt) ?? 0) > 90,
    },
    {
      id: 'RECOVERY_WATCH',
      label: 'Delivery recovery',
      description: 'Customers with a failed delivery or repeated cancellation history.',
      recommendedAction: 'Confirm timing and address before dispatch; never treat this as a blacklist.',
      matches: (customer) =>
        customer.orderStats.failedDeliveries > 0 || customer.orderStats.cancelledOrders >= 2,
    },
  ];
  return definitions.map((definition) => {
    const matches = customers.filter(definition.matches);
    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      recommendedAction: definition.recommendedAction,
      customerIds: matches.map((customer) => customer.id),
      customerNames: matches.map((customer) => customer.name),
      count: matches.length,
      revenueUsdMinor: matches.reduce(
        (sum, customer) => sum + customer.orderStats.lifetimeSpendUsdMinor,
        0,
      ),
    };
  });
}

function integrations(config: AppConfig): IntegrationProvider[] {
  const values: IntegrationProvider[] = [
    {
      id: 'masaar-in-app',
      name: 'Masaar Action Center',
      category: 'MESSAGING',
      status: 'CONNECTED',
      officialOnly: true,
      summary: 'Operational alerts are generated from tenant-scoped Masaar records.',
      fallback: 'The owner can inspect the source order, stock item or cash record directly.',
      nextStep: 'Keep alert thresholds and assigned responsibility under review.',
    },
    {
      id: 'aws-cognito',
      name: 'Amazon Cognito',
      category: 'IDENTITY',
      status: config.AUTH_MODE === 'cognito' ? 'CONNECTED' : 'SANDBOX',
      officialOnly: true,
      summary:
        config.AUTH_MODE === 'cognito'
          ? 'Production identity boundary is enabled.'
          : 'Local role simulation is active; no production identity is claimed.',
      fallback: 'Development demo accounts remain isolated to the local environment.',
      nextStep: 'Deploy the SAM stack and configure the Cognito user pool before pilot access.',
    },
    {
      id: 'amazon-rds-sqlserver',
      name: 'Amazon RDS for SQL Server',
      category: 'DATABASE',
      status: config.SQLSERVER_CONNECTION_STRING ? 'CONNECTED' : 'SANDBOX',
      officialOnly: true,
      summary: config.SQLSERVER_CONNECTION_STRING
        ? 'Persistent SQL Server repositories and operator views are configured.'
        : 'In-memory repositories are active for local demonstration; no persistent database is claimed.',
      fallback: 'Local seeded data keeps the competition demo deterministic.',
      nextStep: 'Create the RDS SQL Server database, set the encrypted connection secret and rehearse an SSMS restore.',
    },
    {
      id: 'amazon-ses',
      name: 'Amazon SES email',
      category: 'EMAIL',
      status: 'READY_TO_CONFIGURE',
      officialOnly: true,
      summary: 'Email delivery is intentionally not presented as live without a verified sender.',
      fallback: 'In-app Action Center notifications remain the source of truth.',
      nextStep: 'Verify a sender/domain, add consent preferences and connect SES in the pilot account.',
    },
    {
      id: 'whatsapp-business',
      name: 'WhatsApp Business Platform',
      category: 'MESSAGING',
      status: 'MANUAL_FALLBACK',
      officialOnly: true,
      summary: 'Masaar creates accurate templates; the user copies them into WhatsApp today.',
      fallback: 'Copy remains explicit and audited; Masaar never claims a message was sent.',
      nextStep: 'Connect only Meta’s official API after template and consent approval.',
    },
    {
      id: 'delivery-providers',
      name: 'Delivery provider adapters',
      category: 'DELIVERY',
      status: 'MANUAL_FALLBACK',
      officialOnly: true,
      summary: 'Internal, freelance and company resources can already be configured manually.',
      fallback: 'Assignment, attempts, fees and reconciliation remain fully usable without an API.',
      nextStep: 'Pilot one provider with an official API and retain visible sync health.',
    },
    {
      id: 'payment-providers',
      name: 'Whish / OMT / card adapters',
      category: 'PAYMENTS',
      status: 'MANUAL_FALLBACK',
      officialOnly: true,
      summary: 'References and proofs are recorded without falsely claiming automatic settlement.',
      fallback: 'Staff records the provider reference and Masaar preserves payment/cash separation.',
      nextStep: 'Connect an approved provider only when webhooks and reconciliation are available.',
    },
  ];
  return values.map((value) => integrationProviderSchema.parse(value));
}

export async function registerExpansionRoutes(
  app: FastifyInstance,
  dependencies: {
    config: AppConfig;
    expansion: ExpansionRepository;
    commerce: CommerceRepository;
    orders: OrderRepository;
    fulfillment: FulfillmentRepository;
    audit: AuditRepository;
  },
) {
  const { config, expansion, commerce, orders, fulfillment, audit } = dependencies;

  app.get(
    '/api/expansion/snapshot',
    { preHandler: requirePermission('analytics:read') },
    async (request) => {
      const tenantId = request.session!.tenantId;
      const [products, customers, orderList, resources, zones, payments, tasks] = await Promise.all([
        commerce.listProducts(tenantId),
        commerce.listCustomers(tenantId),
        orders.list(tenantId),
        fulfillment.listResources(tenantId),
        fulfillment.listZones(tenantId),
        fulfillment.listPaymentEntries(tenantId),
        expansion.listAdminTasks(tenantId),
      ]);
      const checks: LaunchCheck[] = [
        {
          id: 'catalog',
          label: 'Structured catalog',
          detail: products.length
            ? `${products.length} product(s) can feed orders and intelligence.`
            : 'Add the first product, variant, price and cost.',
          complete: products.length > 0,
          target: 'Catalog',
        },
        {
          id: 'customers',
          label: 'Customer records',
          detail: customers.length
            ? `${customers.length} customer profile(s) are available for repeat-business insight.`
            : 'Create or confirm the first customer profile.',
          complete: customers.length > 0,
          target: 'Customers',
        },
        {
          id: 'orders',
          label: 'Operational history',
          detail: orderList.length
            ? `${orderList.length} order(s) supply lifecycle evidence.`
            : 'Capture the first real order from a selling channel.',
          complete: orderList.length > 0,
          target: 'Orders',
        },
        {
          id: 'delivery-resources',
          label: 'Delivery responsibility',
          detail: resources.length
            ? `${resources.length} driver/company resource(s) can be assigned.`
            : 'Add an internal driver, freelancer or external company.',
          complete: resources.length > 0,
          target: 'Business setup',
        },
        {
          id: 'delivery-zones',
          label: 'Lebanon delivery zones',
          detail: zones.length
            ? `${zones.length} configurable zone(s) cover fees and service areas.`
            : 'Add service zones and explicit fees.',
          complete: zones.length > 0,
          target: 'Delivery',
        },
        {
          id: 'payment-ledger',
          label: 'Payment evidence',
          detail: payments.length
            ? `${payments.length} payment entry/entries support cash and completion metrics.`
            : 'Post a payment or complete a cash-on-delivery stop.',
          complete: payments.length > 0,
          target: 'Payments',
        },
        {
          id: 'persistent-data',
          label: 'Persistent pilot data',
          detail: config.SQLSERVER_CONNECTION_STRING
            ? 'Amazon RDS / SQL Server persistence is configured and the schema is verified at startup.'
            : 'Local in-memory repositories are active; configure SQL Server before pilot use.',
          complete: Boolean(config.SQLSERVER_CONNECTION_STRING),
          target: 'Launch Center',
        },
        {
          id: 'production-identity',
          label: 'Production identity',
          detail:
            config.AUTH_MODE === 'cognito'
              ? 'Amazon Cognito is the active authentication boundary.'
              : 'Development role simulation is active; Cognito is required before pilot access.',
          complete: config.AUTH_MODE === 'cognito',
          target: 'Business setup',
        },
      ];
      return expansionSnapshotSchema.parse({
        generatedAt: new Date().toISOString(),
        releaseLabel: 'PHASE_9_RELEASE_CANDIDATE',
        readinessPercent: Math.round(
          (checks.filter((check) => check.complete).length / checks.length) * 100,
        ),
        checks,
        integrations: integrations(config),
        adminTasks: tasks,
        segments: segmentCustomers(customers),
        guardrails: {
          adminAdvice: 'REMINDERS_NOT_LEGAL_ADVICE',
          providers: 'OFFICIAL_APIS_ONLY',
          customerUse: 'SEGMENTS_NOT_BLACKLISTS',
          automation: 'HUMAN_APPROVAL_REQUIRED',
        },
      });
    },
  );

  app.post(
    '/api/expansion/admin-tasks',
    { preHandler: requirePermission('business:manage') },
    async (request, reply) => {
      const input = createAdminTaskSchema.parse(request.body);
      const now = new Date().toISOString();
      const task = adminTaskSchema.parse({
        ...input,
        id: `adm_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
        updatedBy: request.session!.userId,
      });
      await expansion.saveAdminTask(task);
      await recordAudit(audit, {
        session: request.session!,
        action: 'admin.reminder_created',
        entityType: 'adminTask',
        entityId: task.id,
        correlationId: request.correlationId,
        after: task,
      });
      return reply.code(201).send(task);
    },
  );

  app.patch(
    '/api/expansion/admin-tasks/:id',
    { preHandler: requirePermission('business:manage') },
    async (request) => {
      const { id } = request.params as { id: string };
      const input = updateAdminTaskSchema.parse(request.body);
      const before = await expansion.getAdminTask(request.session!.tenantId, id);
      if (!before) throw app.httpErrors.notFound('Administrative reminder not found.');
      const after = adminTaskSchema.parse({
        ...before,
        ...input,
        updatedAt: new Date().toISOString(),
        updatedBy: request.session!.userId,
      });
      await expansion.saveAdminTask(after);
      await recordAudit(audit, {
        session: request.session!,
        action: after.status === 'DONE' ? 'admin.reminder_completed' : 'admin.reminder_updated',
        entityType: 'adminTask',
        entityId: id,
        correlationId: request.correlationId,
        before,
        after,
      });
      return after;
    },
  );
}
