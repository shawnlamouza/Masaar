import sql from 'mssql';
import {
  adminTaskSchema,
  auditEventSchema,
  businessSettingsSchema,
  custodyMovementSchema,
  customerSchema,
  deliveryCaseSchema,
  deliveryResourceSchema,
  deliveryZoneSchema,
  fxSnapshotSchema,
  inventoryMovementSchema,
  orderSchema,
  paymentEntrySchema,
  priceReviewSchema,
  productSchema,
  reconciliationSchema,
  returnCaseSchema,
  supplierSchema,
  type AdminTask,
  type AuditEvent,
  type BusinessSettings,
  type CustodyMovement,
  type Customer,
  type DeliveryCase,
  type DeliveryResource,
  type DeliveryZone,
  type FxSnapshot,
  type InventoryMovement,
  type Order,
  type PaymentEntry,
  type PriceReview,
  type Product,
  type Reconciliation,
  type ReturnCase,
  type Supplier,
} from '@masaar/contracts';
import type { AuditRepository } from './audit.js';
import type { AppConfig } from './config.js';
import type { BusinessSettingsRepository } from './settings.js';
import type { CommerceRepository } from './commerce-repository.js';
import type { OrderRepository } from './order-repository.js';
import type { DriverCommandResult, FulfillmentRepository } from './fulfillment-repository.js';
import type { NotificationStateRepository } from './notification-repository.js';
import type { InventoryRepository } from './inventory-repository.js';
import {
  defaultAdminTasks,
  effectiveAdminStatus,
  type ExpansionRepository,
} from './expansion-repository.js';
import { SQLSERVER_SCHEMA_BATCHES, SQLSERVER_VIEW_BATCHES } from './sqlserver-schema.js';

type Schema<T> = { parse(value: unknown): T };
type SqlField = { column: string; value: unknown };

function date(value: string) {
  return new Date(value);
}

function payload(value: unknown) {
  return JSON.stringify(value);
}

function parsePayload<T>(value: unknown, schema: Schema<T>): T {
  if (typeof value !== 'string') throw new Error('SQL Server returned an invalid JSON payload.');
  return schema.parse(JSON.parse(value));
}

async function listAggregates<T>(
  pool: sql.ConnectionPool,
  table: string,
  tenantId: string,
  schema: Schema<T>,
  orderBy: string,
) {
  const result = await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .query<{ payload_json: string }>(
      `SELECT payload_json FROM dbo.${table} WHERE tenant_id = @tenantId ORDER BY ${orderBy}`,
    );
  return result.recordset.map((row) => parsePayload(row.payload_json, schema));
}

async function getAggregate<T>(
  pool: sql.ConnectionPool,
  table: string,
  idColumn: string,
  tenantId: string,
  entityId: string,
  schema: Schema<T>,
) {
  const result = await pool
    .request()
    .input('tenantId', sql.NVarChar(128), tenantId)
    .input('entityId', sql.NVarChar(128), entityId)
    .query<{ payload_json: string }>(
      `SELECT payload_json FROM dbo.${table} WHERE tenant_id = @tenantId AND ${idColumn} = @entityId`,
    );
  const row = result.recordset[0];
  return row ? parsePayload(row.payload_json, schema) : null;
}

async function upsertAggregate(input: {
  pool: sql.ConnectionPool;
  table: string;
  idColumn: string;
  tenantId: string;
  entityId: string;
  value: unknown;
  fields: Record<string, SqlField>;
}) {
  const request = input.pool
    .request()
    .input('tenantId', sql.NVarChar(128), input.tenantId)
    .input('entityId', sql.NVarChar(128), input.entityId)
    .input('payloadJson', sql.NVarChar(sql.MAX), payload(input.value));
  for (const [parameter, field] of Object.entries(input.fields))
    request.input(parameter, field.value);
  const fieldEntries = Object.entries(input.fields);
  const updateAssignments = [
    ...fieldEntries.map(([parameter, field]) => `${field.column} = @${parameter}`),
    'payload_json = @payloadJson',
  ].join(', ');
  const insertColumns = [
    'tenant_id',
    input.idColumn,
    ...fieldEntries.map(([, field]) => field.column),
    'payload_json',
  ].join(', ');
  const insertValues = [
    '@tenantId',
    '@entityId',
    ...fieldEntries.map(([parameter]) => `@${parameter}`),
    '@payloadJson',
  ].join(', ');
  await request.query(
    `UPDATE dbo.${input.table} SET ${updateAssignments}
     WHERE tenant_id = @tenantId AND ${input.idColumn} = @entityId;
     IF @@ROWCOUNT = 0
       INSERT INTO dbo.${input.table} (${insertColumns}) VALUES (${insertValues});`,
  );
}

class SqlServerAuditRepository implements AuditRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async append(event: AuditEvent) {
    const parsed = auditEventSchema.parse(event);
    await this.pool
      .request()
      .input('eventId', sql.NVarChar(128), parsed.id)
      .input('tenantId', sql.NVarChar(128), parsed.tenantId)
      .input('actorId', sql.NVarChar(128), parsed.actorId)
      .input('actorRole', sql.NVarChar(32), parsed.actorRole)
      .input('actionName', sql.NVarChar(160), parsed.action)
      .input('entityType', sql.NVarChar(100), parsed.entityType)
      .input('entityId', sql.NVarChar(128), parsed.entityId)
      .input('occurredAt', sql.DateTime2(3), date(parsed.occurredAt))
      .input('correlationId', sql.NVarChar(128), parsed.correlationId)
      .input('payloadJson', sql.NVarChar(sql.MAX), payload(parsed))
      .query(
        `INSERT INTO dbo.audit_events
         (event_id, tenant_id, actor_id, actor_role, action_name, entity_type, entity_id, occurred_at, correlation_id, payload_json)
         VALUES (@eventId, @tenantId, @actorId, @actorRole, @actionName, @entityType, @entityId, @occurredAt, @correlationId, @payloadJson)`,
      );
  }

  async listForTenant(tenantId: string) {
    return listAggregates(
      this.pool,
      'audit_events',
      tenantId,
      auditEventSchema,
      'occurred_at DESC',
    );
  }
}

class SqlServerBusinessSettingsRepository implements BusinessSettingsRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async get(tenantId: string) {
    const result = await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), tenantId)
      .query<{ payload_json: string }>(
        'SELECT payload_json FROM dbo.business_settings WHERE tenant_id = @tenantId',
      );
    const row = result.recordset[0];
    return row ? parsePayload(row.payload_json, businessSettingsSchema) : null;
  }

  async put(settings: BusinessSettings) {
    const parsed = businessSettingsSchema.parse(settings);
    const request = this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), parsed.tenantId)
      .input('businessName', sql.NVarChar(200), parsed.businessName)
      .input('updatedAt', sql.DateTime2(3), date(parsed.updatedAt))
      .input('payloadJson', sql.NVarChar(sql.MAX), payload(parsed));
    await request.query(
      `UPDATE dbo.business_settings
       SET business_name = @businessName, updated_at = @updatedAt, payload_json = @payloadJson
       WHERE tenant_id = @tenantId;
       IF @@ROWCOUNT = 0
         INSERT INTO dbo.business_settings (tenant_id, business_name, updated_at, payload_json)
         VALUES (@tenantId, @businessName, @updatedAt, @payloadJson);`,
    );
  }
}

class SqlServerCommerceRepository implements CommerceRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async listProducts(tenantId: string) {
    return listAggregates(this.pool, 'products', tenantId, productSchema, 'product_name ASC');
  }
  async getProduct(tenantId: string, id: string) {
    return getAggregate(this.pool, 'products', 'product_id', tenantId, id, productSchema);
  }
  async saveProduct(product: Product) {
    const parsed = productSchema.parse(product);
    await upsertAggregate({
      pool: this.pool,
      table: 'products',
      idColumn: 'product_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        productName: { column: 'product_name', value: parsed.name },
        category: { column: 'category', value: parsed.category },
        isActive: { column: 'is_active', value: parsed.active },
        tracksStock: { column: 'tracks_stock', value: parsed.trackStock },
        updatedAt: { column: 'updated_at', value: date(parsed.updatedAt) },
      },
    });
  }
  async listSuppliers(tenantId: string) {
    return listAggregates(this.pool, 'suppliers', tenantId, supplierSchema, 'supplier_name ASC');
  }
  async getSupplier(tenantId: string, id: string) {
    return getAggregate(this.pool, 'suppliers', 'supplier_id', tenantId, id, supplierSchema);
  }
  async saveSupplier(supplier: Supplier) {
    const parsed = supplierSchema.parse(supplier);
    await upsertAggregate({
      pool: this.pool,
      table: 'suppliers',
      idColumn: 'supplier_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        supplierName: { column: 'supplier_name', value: parsed.name },
        phone: { column: 'phone', value: parsed.phone ?? '' },
        isActive: { column: 'is_active', value: parsed.active },
        updatedAt: { column: 'updated_at', value: date(parsed.updatedAt) },
      },
    });
  }
  async listCustomers(tenantId: string) {
    return listAggregates(this.pool, 'customers', tenantId, customerSchema, 'customer_name ASC');
  }
  async getCustomer(tenantId: string, id: string) {
    return getAggregate(this.pool, 'customers', 'customer_id', tenantId, id, customerSchema);
  }
  async saveCustomer(customer: Customer) {
    const parsed = customerSchema.parse(customer);
    await upsertAggregate({
      pool: this.pool,
      table: 'customers',
      idColumn: 'customer_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        customerName: { column: 'customer_name', value: parsed.name },
        phoneNormalized: { column: 'phone_normalized', value: parsed.phoneNormalized },
        preferredPaymentMethod: {
          column: 'preferred_payment_method',
          value: parsed.preferredPaymentMethod,
        },
        updatedAt: { column: 'updated_at', value: date(parsed.updatedAt) },
      },
    });
  }
  async listFxSnapshots(tenantId: string) {
    return listAggregates(
      this.pool,
      'fx_snapshots',
      tenantId,
      fxSnapshotSchema,
      'effective_at DESC',
    );
  }
  async getFxSnapshot(tenantId: string, id: string) {
    return getAggregate(this.pool, 'fx_snapshots', 'snapshot_id', tenantId, id, fxSnapshotSchema);
  }
  async saveFxSnapshot(snapshot: FxSnapshot) {
    const parsed = fxSnapshotSchema.parse(snapshot);
    await upsertAggregate({
      pool: this.pool,
      table: 'fx_snapshots',
      idColumn: 'snapshot_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        lbpPerUsd: { column: 'lbp_per_usd', value: parsed.lbpPerUsd },
        effectiveAt: { column: 'effective_at', value: date(parsed.effectiveAt) },
        sourceName: { column: 'source_name', value: parsed.source },
      },
    });
  }
  async listPriceReviews(tenantId: string) {
    return listAggregates(
      this.pool,
      'price_reviews',
      tenantId,
      priceReviewSchema,
      'created_at DESC',
    );
  }
  async getPriceReview(tenantId: string, id: string) {
    return getAggregate(this.pool, 'price_reviews', 'review_id', tenantId, id, priceReviewSchema);
  }
  async savePriceReview(review: PriceReview) {
    const parsed = priceReviewSchema.parse(review);
    const first = parsed.items[0]!;
    await upsertAggregate({
      pool: this.pool,
      table: 'price_reviews',
      idColumn: 'review_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        productId: { column: 'product_id', value: first.productId },
        variantId: { column: 'variant_id', value: first.variantId },
        reviewStatus: { column: 'review_status', value: parsed.status },
        createdAt: { column: 'created_at', value: date(parsed.createdAt) },
      },
    });
  }
}

class SqlServerOrderRepository implements OrderRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async list(tenantId: string) {
    return listAggregates(this.pool, 'orders', tenantId, orderSchema, 'created_at DESC');
  }
  async get(tenantId: string, id: string) {
    return getAggregate(this.pool, 'orders', 'order_id', tenantId, id, orderSchema);
  }
  async save(order: Order, confirmationHash = '') {
    const parsed = orderSchema.parse(order);
    const request = this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), parsed.tenantId)
      .input('orderId', sql.NVarChar(128), parsed.id)
      .input('orderNumber', sql.NVarChar(64), parsed.orderNumber)
      .input('orderStatus', sql.NVarChar(64), parsed.status)
      .input('sourceChannel', sql.NVarChar(40), parsed.source)
      .input('customerName', sql.NVarChar(200), parsed.customerName)
      .input('customerPhone', sql.NVarChar(40), parsed.customerPhone)
      .input('currencyCode', sql.Char(3), parsed.currency)
      .input('grandTotalMinor', sql.BigInt, `${parsed.totals.grandTotal.amountMinor}`)
      .input('amountDueMinor', sql.BigInt, `${parsed.totals.amountDue.amountMinor}`)
      .input('confirmationHash', sql.Char(64), confirmationHash || null)
      .input('createdAt', sql.DateTime2(3), date(parsed.createdAt))
      .input('updatedAt', sql.DateTime2(3), date(parsed.updatedAt))
      .input('payloadJson', sql.NVarChar(sql.MAX), payload(parsed));
    await request.query(
      `UPDATE dbo.orders SET
         order_number = @orderNumber, order_status = @orderStatus, source_channel = @sourceChannel,
         customer_name = @customerName, customer_phone = @customerPhone,
         currency_code = @currencyCode, grand_total_minor = @grandTotalMinor,
         amount_due_minor = @amountDueMinor,
         confirmation_hash = COALESCE(@confirmationHash, confirmation_hash),
         created_at = @createdAt, updated_at = @updatedAt, payload_json = @payloadJson
       WHERE tenant_id = @tenantId AND order_id = @orderId;
       IF @@ROWCOUNT = 0
         INSERT INTO dbo.orders
           (tenant_id, order_id, order_number, order_status, source_channel, customer_name,
            customer_phone, currency_code, grand_total_minor, amount_due_minor, confirmation_hash,
            created_at, updated_at, payload_json)
         VALUES
           (@tenantId, @orderId, @orderNumber, @orderStatus, @sourceChannel, @customerName,
            @customerPhone, @currencyCode, @grandTotalMinor, @amountDueMinor, @confirmationHash,
            @createdAt, @updatedAt, @payloadJson);`,
    );
  }
  async findByConfirmationHash(hash: string) {
    const result = await this.pool
      .request()
      .input('confirmationHash', sql.Char(64), hash)
      .query<{ payload_json: string }>(
        'SELECT payload_json FROM dbo.orders WHERE confirmation_hash = @confirmationHash',
      );
    const row = result.recordset[0];
    return row ? parsePayload(row.payload_json, orderSchema) : null;
  }
}

class SqlServerFulfillmentRepository implements FulfillmentRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async listResources(tenantId: string) {
    return listAggregates(
      this.pool,
      'delivery_resources',
      tenantId,
      deliveryResourceSchema,
      'resource_name ASC',
    );
  }
  async saveResource(resource: DeliveryResource) {
    const parsed = deliveryResourceSchema.parse(resource);
    await upsertAggregate({
      pool: this.pool,
      table: 'delivery_resources',
      idColumn: 'resource_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        resourceName: { column: 'resource_name', value: parsed.name },
        resourceType: { column: 'resource_type', value: parsed.type },
        phone: { column: 'phone', value: parsed.phone },
        isActive: { column: 'is_active', value: parsed.active },
        updatedAt: { column: 'updated_at', value: date(parsed.updatedAt) },
      },
    });
  }
  async listZones(tenantId: string) {
    return listAggregates(
      this.pool,
      'delivery_zones',
      tenantId,
      deliveryZoneSchema,
      'zone_name ASC',
    );
  }
  async saveZone(zone: DeliveryZone) {
    const parsed = deliveryZoneSchema.parse(zone);
    await upsertAggregate({
      pool: this.pool,
      table: 'delivery_zones',
      idColumn: 'zone_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        zoneName: { column: 'zone_name', value: parsed.name },
        customerFeeMinor: {
          column: 'customer_fee_minor',
          value: `${parsed.customerFee.amountMinor}`,
        },
        businessCostMinor: {
          column: 'business_cost_minor',
          value: `${parsed.businessCost.amountMinor}`,
        },
        currencyCode: { column: 'currency_code', value: parsed.customerFee.currency },
        isActive: { column: 'is_active', value: parsed.active },
      },
    });
  }
  async listDeliveries(tenantId: string) {
    return listAggregates(this.pool, 'deliveries', tenantId, deliveryCaseSchema, 'updated_at DESC');
  }
  async getDelivery(tenantId: string, id: string) {
    return getAggregate(this.pool, 'deliveries', 'delivery_id', tenantId, id, deliveryCaseSchema);
  }
  async getDeliveryForOrder(tenantId: string, orderId: string) {
    const result = await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('orderId', sql.NVarChar(128), orderId)
      .query<{ payload_json: string }>(
        `SELECT TOP (1) payload_json FROM dbo.deliveries
         WHERE tenant_id = @tenantId AND order_id = @orderId AND delivery_status <> N'CANCELLED'
         ORDER BY updated_at DESC`,
      );
    const row = result.recordset[0];
    return row ? parsePayload(row.payload_json, deliveryCaseSchema) : null;
  }
  async saveDelivery(delivery: DeliveryCase) {
    const parsed = deliveryCaseSchema.parse(delivery);
    await upsertAggregate({
      pool: this.pool,
      table: 'deliveries',
      idColumn: 'delivery_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        orderId: { column: 'order_id', value: parsed.orderId },
        orderNumber: { column: 'order_number', value: parsed.orderNumber },
        deliveryStatus: { column: 'delivery_status', value: parsed.status },
        resourceId: { column: 'resource_id', value: parsed.resourceId },
        resourceName: { column: 'resource_name', value: parsed.resourceName },
        zoneId: { column: 'zone_id', value: parsed.zoneId },
        expectedCollectionMinor: {
          column: 'expected_collection_minor',
          value: `${parsed.expectedCollection.amountMinor}`,
        },
        currencyCode: { column: 'currency_code', value: parsed.expectedCollection.currency },
        versionNumber: { column: 'version_number', value: parsed.version },
        updatedAt: { column: 'updated_at', value: date(parsed.updatedAt) },
      },
    });
  }
  async listPaymentEntries(tenantId: string) {
    return listAggregates(
      this.pool,
      'payment_entries',
      tenantId,
      paymentEntrySchema,
      'occurred_at DESC',
    );
  }
  async savePaymentEntry(paymentEntry: PaymentEntry) {
    const parsed = paymentEntrySchema.parse(paymentEntry);
    await upsertAggregate({
      pool: this.pool,
      table: 'payment_entries',
      idColumn: 'payment_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        orderId: { column: 'order_id', value: parsed.orderId },
        orderNumber: { column: 'order_number', value: parsed.orderNumber },
        paymentType: { column: 'payment_type', value: parsed.type },
        paymentMethod: { column: 'payment_method', value: parsed.method },
        paymentStatus: { column: 'payment_status', value: parsed.status },
        amountMinor: { column: 'amount_minor', value: `${parsed.amount.amountMinor}` },
        currencyCode: { column: 'currency_code', value: parsed.amount.currency },
        holderId: { column: 'holder_id', value: parsed.holderId ?? null },
        occurredAt: { column: 'occurred_at', value: date(parsed.occurredAt) },
      },
    });
  }
  async listCustodyMovements(tenantId: string) {
    return listAggregates(
      this.pool,
      'custody_movements',
      tenantId,
      custodyMovementSchema,
      'occurred_at DESC',
    );
  }
  async saveCustodyMovement(movement: CustodyMovement) {
    const parsed = custodyMovementSchema.parse(movement);
    await upsertAggregate({
      pool: this.pool,
      table: 'custody_movements',
      idColumn: 'movement_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        paymentId: { column: 'payment_id', value: parsed.paymentId ?? null },
        movementType: { column: 'movement_type', value: parsed.type },
        amountMinor: { column: 'amount_minor', value: `${parsed.amount.amountMinor}` },
        currencyCode: { column: 'currency_code', value: parsed.amount.currency },
        fromHolderId: { column: 'from_holder_id', value: parsed.fromHolderId ?? null },
        toHolderId: { column: 'to_holder_id', value: parsed.toHolderId ?? null },
        occurredAt: { column: 'occurred_at', value: date(parsed.occurredAt) },
      },
    });
  }
  async listReconciliations(tenantId: string) {
    return listAggregates(
      this.pool,
      'reconciliations',
      tenantId,
      reconciliationSchema,
      'created_at DESC',
    );
  }
  async getReconciliation(tenantId: string, id: string) {
    return getAggregate(
      this.pool,
      'reconciliations',
      'reconciliation_id',
      tenantId,
      id,
      reconciliationSchema,
    );
  }
  async saveReconciliation(reconciliation: Reconciliation) {
    const parsed = reconciliationSchema.parse(reconciliation);
    await upsertAggregate({
      pool: this.pool,
      table: 'reconciliations',
      idColumn: 'reconciliation_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        holderId: { column: 'holder_id', value: parsed.holderId },
        holderName: { column: 'holder_name', value: parsed.holderName },
        reconciliationStatus: { column: 'reconciliation_status', value: parsed.status },
        expectedMinor: { column: 'expected_minor', value: `${parsed.expected.amountMinor}` },
        returnedMinor: { column: 'returned_minor', value: `${parsed.returned.amountMinor}` },
        discrepancyMinor: { column: 'discrepancy_minor', value: `${parsed.variance.amountMinor}` },
        currencyCode: { column: 'currency_code', value: parsed.currency },
        createdAt: { column: 'created_at', value: date(parsed.createdAt) },
      },
    });
  }
  async getCommandResult(tenantId: string, commandId: string) {
    const result = await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('commandId', sql.NVarChar(128), commandId)
      .query<{ result_json: string }>(
        'SELECT result_json FROM dbo.driver_commands WHERE tenant_id = @tenantId AND command_id = @commandId',
      );
    const row = result.recordset[0];
    return row ? (JSON.parse(row.result_json) as DriverCommandResult) : null;
  }
  async saveCommandResult(tenantId: string, commandId: string, result: DriverCommandResult) {
    await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('commandId', sql.NVarChar(128), commandId)
      .input('resultJson', sql.NVarChar(sql.MAX), payload(result))
      .query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.driver_commands WHERE tenant_id = @tenantId AND command_id = @commandId)
           INSERT INTO dbo.driver_commands (tenant_id, command_id, result_json)
           VALUES (@tenantId, @commandId, @resultJson);`,
      );
  }
}

class SqlServerNotificationStateRepository implements NotificationStateRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}
  async listReadIds(tenantId: string, userId: string) {
    const result = await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('userId', sql.NVarChar(128), userId)
      .query<{ notification_id: string }>(
        'SELECT notification_id FROM dbo.notification_reads WHERE tenant_id = @tenantId AND user_id = @userId',
      );
    return result.recordset.map((row) => row.notification_id);
  }
  async markRead(tenantId: string, userId: string, notificationId: string) {
    await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('userId', sql.NVarChar(128), userId)
      .input('notificationId', sql.NVarChar(160), notificationId)
      .query(
        `IF NOT EXISTS (
           SELECT 1 FROM dbo.notification_reads
           WHERE tenant_id = @tenantId AND user_id = @userId AND notification_id = @notificationId
         )
         INSERT INTO dbo.notification_reads (tenant_id, user_id, notification_id)
         VALUES (@tenantId, @userId, @notificationId);`,
      );
  }
}

class SqlServerInventoryRepository implements InventoryRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}
  async listMovements(tenantId: string) {
    return listAggregates(
      this.pool,
      'inventory_movements',
      tenantId,
      inventoryMovementSchema,
      'created_at DESC',
    );
  }
  async findMovementByKey(tenantId: string, idempotencyKey: string) {
    const result = await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), tenantId)
      .input('idempotencyKey', sql.NVarChar(200), idempotencyKey)
      .query<{ payload_json: string }>(
        'SELECT payload_json FROM dbo.inventory_movements WHERE tenant_id = @tenantId AND idempotency_key = @idempotencyKey',
      );
    const row = result.recordset[0];
    return row ? parsePayload(row.payload_json, inventoryMovementSchema) : null;
  }
  async saveMovement(movement: InventoryMovement) {
    const parsed = inventoryMovementSchema.parse(movement);
    await this.pool
      .request()
      .input('tenantId', sql.NVarChar(128), parsed.tenantId)
      .input('movementId', sql.NVarChar(128), parsed.id)
      .input('idempotencyKey', sql.NVarChar(200), parsed.idempotencyKey)
      .input('productId', sql.NVarChar(128), parsed.productId)
      .input('variantId', sql.NVarChar(128), parsed.variantId)
      .input('movementType', sql.NVarChar(40), parsed.type)
      .input('quantityDelta', sql.Int, parsed.onHandDelta)
      .input('createdAt', sql.DateTime2(3), date(parsed.createdAt))
      .input('payloadJson', sql.NVarChar(sql.MAX), payload(parsed))
      .query(
        `IF NOT EXISTS (
           SELECT 1 FROM dbo.inventory_movements
           WHERE tenant_id = @tenantId AND idempotency_key = @idempotencyKey
         )
         INSERT INTO dbo.inventory_movements
           (tenant_id, movement_id, idempotency_key, product_id, variant_id, movement_type,
            quantity_delta, created_at, payload_json)
         VALUES
           (@tenantId, @movementId, @idempotencyKey, @productId, @variantId, @movementType,
            @quantityDelta, @createdAt, @payloadJson);`,
      );
  }
  async listReturns(tenantId: string) {
    return listAggregates(this.pool, 'return_cases', tenantId, returnCaseSchema, 'created_at DESC');
  }
  async getReturn(tenantId: string, id: string) {
    return getAggregate(this.pool, 'return_cases', 'return_id', tenantId, id, returnCaseSchema);
  }
  async saveReturn(returnCase: ReturnCase) {
    const parsed = returnCaseSchema.parse(returnCase);
    const updatedAt = parsed.resolvedAt ?? parsed.receivedAt ?? parsed.createdAt;
    await upsertAggregate({
      pool: this.pool,
      table: 'return_cases',
      idColumn: 'return_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        orderId: { column: 'order_id', value: parsed.orderId },
        orderNumber: { column: 'order_number', value: parsed.orderNumber },
        returnStatus: { column: 'return_status', value: parsed.status },
        createdAt: { column: 'created_at', value: date(parsed.createdAt) },
        updatedAt: { column: 'updated_at', value: date(updatedAt) },
      },
    });
  }
}

class SqlServerExpansionRepository implements ExpansionRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}
  async listAdminTasks(tenantId: string) {
    let tasks = await listAggregates(
      this.pool,
      'admin_tasks',
      tenantId,
      adminTaskSchema,
      'due_date ASC, updated_at DESC',
    );
    if (!tasks.length) {
      tasks = defaultAdminTasks(tenantId);
      await Promise.all(tasks.map((task) => this.saveAdminTask(task)));
    }
    return tasks.map((task) => ({ ...task, status: effectiveAdminStatus(task) }));
  }
  async getAdminTask(tenantId: string, id: string) {
    const task = await getAggregate(
      this.pool,
      'admin_tasks',
      'task_id',
      tenantId,
      id,
      adminTaskSchema,
    );
    return task ? { ...task, status: effectiveAdminStatus(task) } : null;
  }
  async saveAdminTask(task: AdminTask) {
    const parsed = adminTaskSchema.parse(task);
    await upsertAggregate({
      pool: this.pool,
      table: 'admin_tasks',
      idColumn: 'task_id',
      tenantId: parsed.tenantId,
      entityId: parsed.id,
      value: parsed,
      fields: {
        title: { column: 'title', value: parsed.title },
        category: { column: 'category', value: parsed.category },
        taskStatus: { column: 'task_status', value: parsed.status },
        dueDate: {
          column: 'due_date',
          value: parsed.dueDate ? new Date(`${parsed.dueDate}T00:00:00.000Z`) : null,
        },
        responsibleName: { column: 'responsible_name', value: parsed.responsibleName },
        updatedAt: { column: 'updated_at', value: date(parsed.updatedAt) },
      },
    });
  }
}

async function prepareSqlServer(pool: sql.ConnectionPool) {
  for (const statement of SQLSERVER_SCHEMA_BATCHES) await pool.request().batch(statement);
  for (const statement of SQLSERVER_VIEW_BATCHES) await pool.request().batch(statement);
}

function databaseNameFromConnectionString(connectionString: string) {
  const match = connectionString.match(/(?:^|;)\s*(?:Database|Initial Catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim();
}

function masterConnectionString(connectionString: string) {
  if (/(?:^|;)\s*(?:Database|Initial Catalog)\s*=/i.test(connectionString)) {
    return connectionString.replace(
      /((?:^|;)\s*(?:Database|Initial Catalog)\s*=\s*)[^;]+/i,
      '$1master',
    );
  }
  return `${connectionString.replace(/;?\s*$/, '')};Database=master`;
}

async function ensureApplicationDatabase(connectionString: string) {
  const databaseName = databaseNameFromConnectionString(connectionString);
  if (!databaseName || databaseName.toLowerCase() === 'master') return;
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error('SQL Server database name may contain only letters, numbers, and underscores');
  }

  const masterPool = await new sql.ConnectionPool(masterConnectionString(connectionString)).connect();
  try {
    await masterPool.request().batch(
      `IF DB_ID(N'${databaseName}') IS NULL EXEC(N'CREATE DATABASE [${databaseName}]')`,
    );
  } finally {
    await masterPool.close();
  }
}

export async function connectSqlServerRepositories(config: AppConfig) {
  if (!config.SQLSERVER_CONNECTION_STRING) return null;
  await ensureApplicationDatabase(config.SQLSERVER_CONNECTION_STRING);
  const pool = await new sql.ConnectionPool(config.SQLSERVER_CONNECTION_STRING).connect();
  await prepareSqlServer(pool);
  return {
    pool,
    auditRepository: new SqlServerAuditRepository(pool),
    settingsRepository: new SqlServerBusinessSettingsRepository(pool),
    commerceRepository: new SqlServerCommerceRepository(pool),
    orderRepository: new SqlServerOrderRepository(pool),
    fulfillmentRepository: new SqlServerFulfillmentRepository(pool),
    notificationRepository: new SqlServerNotificationStateRepository(pool),
    inventoryRepository: new SqlServerInventoryRepository(pool),
    expansionRepository: new SqlServerExpansionRepository(pool),
  };
}
