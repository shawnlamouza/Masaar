/**
 * SQL Server schema used by both Amazon RDS for SQL Server and a local SQL
 * Server instance opened through SQL Server Management Studio (SSMS).
 *
 * Domain aggregates keep their complete validated JSON snapshot for safe
 * round-tripping, while the columns operators commonly inspect, filter and
 * index remain first-class relational columns.
 */
export const SQLSERVER_SCHEMA_BATCHES = [
  `IF OBJECT_ID(N'dbo.business_settings', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.business_settings (
       tenant_id NVARCHAR(128) NOT NULL CONSTRAINT PK_business_settings PRIMARY KEY,
       business_name NVARCHAR(200) NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT CK_business_settings_json CHECK (ISJSON(payload_json) = 1)
     );
   END`,
  `IF OBJECT_ID(N'dbo.audit_events', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.audit_events (
       event_id NVARCHAR(128) NOT NULL CONSTRAINT PK_audit_events PRIMARY KEY,
       tenant_id NVARCHAR(128) NOT NULL,
       actor_id NVARCHAR(128) NOT NULL,
       actor_role NVARCHAR(32) NOT NULL,
       action_name NVARCHAR(160) NOT NULL,
       entity_type NVARCHAR(100) NOT NULL,
       entity_id NVARCHAR(128) NOT NULL,
       occurred_at DATETIME2(3) NOT NULL,
       correlation_id NVARCHAR(128) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT CK_audit_events_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_audit_events_tenant_time ON dbo.audit_events(tenant_id, occurred_at DESC);
   END`,
  `IF OBJECT_ID(N'dbo.products', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.products (
       tenant_id NVARCHAR(128) NOT NULL,
       product_id NVARCHAR(128) NOT NULL,
       product_name NVARCHAR(200) NOT NULL,
       category NVARCHAR(120) NOT NULL,
       is_active BIT NOT NULL,
       tracks_stock BIT NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_products PRIMARY KEY (tenant_id, product_id),
       CONSTRAINT CK_products_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_products_tenant_name ON dbo.products(tenant_id, product_name);
   END`,
  `IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.suppliers (
       tenant_id NVARCHAR(128) NOT NULL,
       supplier_id NVARCHAR(128) NOT NULL,
       supplier_name NVARCHAR(200) NOT NULL,
       phone NVARCHAR(40) NOT NULL,
       is_active BIT NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_suppliers PRIMARY KEY (tenant_id, supplier_id),
       CONSTRAINT CK_suppliers_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_suppliers_tenant_name ON dbo.suppliers(tenant_id, supplier_name);
   END`,
  `IF OBJECT_ID(N'dbo.customers', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.customers (
       tenant_id NVARCHAR(128) NOT NULL,
       customer_id NVARCHAR(128) NOT NULL,
       customer_name NVARCHAR(200) NOT NULL,
       phone_normalized NVARCHAR(40) NOT NULL,
       preferred_payment_method NVARCHAR(32) NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_customers PRIMARY KEY (tenant_id, customer_id),
       CONSTRAINT UQ_customers_tenant_phone UNIQUE (tenant_id, phone_normalized),
       CONSTRAINT CK_customers_json CHECK (ISJSON(payload_json) = 1)
     );
   END`,
  `IF OBJECT_ID(N'dbo.fx_snapshots', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.fx_snapshots (
       tenant_id NVARCHAR(128) NOT NULL,
       snapshot_id NVARCHAR(128) NOT NULL,
       lbp_per_usd DECIMAL(19,4) NOT NULL,
       effective_at DATETIME2(3) NOT NULL,
       source_name NVARCHAR(64) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_fx_snapshots PRIMARY KEY (tenant_id, snapshot_id),
       CONSTRAINT CK_fx_snapshots_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_fx_snapshots_tenant_time ON dbo.fx_snapshots(tenant_id, effective_at DESC);
   END`,
  `IF OBJECT_ID(N'dbo.price_reviews', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.price_reviews (
       tenant_id NVARCHAR(128) NOT NULL,
       review_id NVARCHAR(128) NOT NULL,
       product_id NVARCHAR(128) NOT NULL,
       variant_id NVARCHAR(128) NOT NULL,
       review_status NVARCHAR(40) NOT NULL,
       created_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_price_reviews PRIMARY KEY (tenant_id, review_id),
       CONSTRAINT CK_price_reviews_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_price_reviews_tenant_time ON dbo.price_reviews(tenant_id, created_at DESC);
   END`,
  `IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.orders (
       tenant_id NVARCHAR(128) NOT NULL,
       order_id NVARCHAR(128) NOT NULL,
       order_number NVARCHAR(64) NOT NULL,
       order_status NVARCHAR(64) NOT NULL,
       source_channel NVARCHAR(40) NOT NULL,
       customer_name NVARCHAR(200) NOT NULL,
       customer_phone NVARCHAR(40) NOT NULL,
       currency_code CHAR(3) NOT NULL,
       grand_total_minor BIGINT NOT NULL,
       amount_due_minor BIGINT NOT NULL,
       confirmation_hash CHAR(64) NULL,
       created_at DATETIME2(3) NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_orders PRIMARY KEY (tenant_id, order_id),
       CONSTRAINT UQ_orders_tenant_number UNIQUE (tenant_id, order_number),
       CONSTRAINT CK_orders_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE UNIQUE INDEX UX_orders_confirmation_hash ON dbo.orders(confirmation_hash) WHERE confirmation_hash IS NOT NULL;
     CREATE INDEX IX_orders_tenant_status_time ON dbo.orders(tenant_id, order_status, updated_at DESC);
     CREATE INDEX IX_orders_tenant_customer_phone ON dbo.orders(tenant_id, customer_phone);
   END`,
  `IF OBJECT_ID(N'dbo.delivery_resources', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.delivery_resources (
       tenant_id NVARCHAR(128) NOT NULL,
       resource_id NVARCHAR(128) NOT NULL,
       resource_name NVARCHAR(200) NOT NULL,
       resource_type NVARCHAR(40) NOT NULL,
       phone NVARCHAR(40) NOT NULL,
       is_active BIT NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_delivery_resources PRIMARY KEY (tenant_id, resource_id),
       CONSTRAINT CK_delivery_resources_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_delivery_resources_tenant_type ON dbo.delivery_resources(tenant_id, resource_type, is_active);
   END`,
  `IF OBJECT_ID(N'dbo.delivery_zones', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.delivery_zones (
       tenant_id NVARCHAR(128) NOT NULL,
       zone_id NVARCHAR(128) NOT NULL,
       zone_name NVARCHAR(200) NOT NULL,
       customer_fee_minor BIGINT NOT NULL,
       business_cost_minor BIGINT NOT NULL,
       currency_code CHAR(3) NOT NULL,
       is_active BIT NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_delivery_zones PRIMARY KEY (tenant_id, zone_id),
       CONSTRAINT CK_delivery_zones_json CHECK (ISJSON(payload_json) = 1)
     );
   END`,
  `IF OBJECT_ID(N'dbo.deliveries', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.deliveries (
       tenant_id NVARCHAR(128) NOT NULL,
       delivery_id NVARCHAR(128) NOT NULL,
       order_id NVARCHAR(128) NOT NULL,
       order_number NVARCHAR(64) NOT NULL,
       delivery_status NVARCHAR(40) NOT NULL,
       resource_id NVARCHAR(128) NOT NULL,
       resource_name NVARCHAR(200) NOT NULL,
       zone_id NVARCHAR(128) NOT NULL,
       expected_collection_minor BIGINT NOT NULL,
       currency_code CHAR(3) NOT NULL,
       version_number INT NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_deliveries PRIMARY KEY (tenant_id, delivery_id),
       CONSTRAINT CK_deliveries_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_deliveries_tenant_order ON dbo.deliveries(tenant_id, order_id, updated_at DESC);
     CREATE INDEX IX_deliveries_tenant_resource_status ON dbo.deliveries(tenant_id, resource_id, delivery_status);
   END`,
  `IF OBJECT_ID(N'dbo.payment_entries', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.payment_entries (
       tenant_id NVARCHAR(128) NOT NULL,
       payment_id NVARCHAR(128) NOT NULL,
       order_id NVARCHAR(128) NOT NULL,
       order_number NVARCHAR(64) NOT NULL,
       payment_type NVARCHAR(40) NOT NULL,
       payment_method NVARCHAR(40) NOT NULL,
       payment_status NVARCHAR(40) NOT NULL,
       amount_minor BIGINT NOT NULL,
       currency_code CHAR(3) NOT NULL,
       holder_id NVARCHAR(128) NULL,
       occurred_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_payment_entries PRIMARY KEY (tenant_id, payment_id),
       CONSTRAINT CK_payment_entries_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_payment_entries_tenant_order ON dbo.payment_entries(tenant_id, order_id, occurred_at DESC);
   END`,
  `IF OBJECT_ID(N'dbo.custody_movements', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.custody_movements (
       tenant_id NVARCHAR(128) NOT NULL,
       movement_id NVARCHAR(128) NOT NULL,
       payment_id NVARCHAR(128) NULL,
       movement_type NVARCHAR(40) NOT NULL,
       amount_minor BIGINT NOT NULL,
       currency_code CHAR(3) NOT NULL,
       from_holder_id NVARCHAR(128) NULL,
       to_holder_id NVARCHAR(128) NULL,
       occurred_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_custody_movements PRIMARY KEY (tenant_id, movement_id),
       CONSTRAINT CK_custody_movements_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_custody_tenant_holders ON dbo.custody_movements(tenant_id, to_holder_id, from_holder_id, occurred_at DESC);
   END`,
  `IF OBJECT_ID(N'dbo.reconciliations', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.reconciliations (
       tenant_id NVARCHAR(128) NOT NULL,
       reconciliation_id NVARCHAR(128) NOT NULL,
       holder_id NVARCHAR(128) NOT NULL,
       holder_name NVARCHAR(200) NOT NULL,
       reconciliation_status NVARCHAR(40) NOT NULL,
       expected_minor BIGINT NOT NULL,
       returned_minor BIGINT NOT NULL,
       discrepancy_minor BIGINT NOT NULL,
       currency_code CHAR(3) NOT NULL,
       created_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_reconciliations PRIMARY KEY (tenant_id, reconciliation_id),
       CONSTRAINT CK_reconciliations_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_reconciliations_tenant_status ON dbo.reconciliations(tenant_id, reconciliation_status, created_at DESC);
   END`,
  `IF OBJECT_ID(N'dbo.driver_commands', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.driver_commands (
       tenant_id NVARCHAR(128) NOT NULL,
       command_id NVARCHAR(128) NOT NULL,
       created_at DATETIME2(3) NOT NULL CONSTRAINT DF_driver_commands_created DEFAULT SYSUTCDATETIME(),
       result_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_driver_commands PRIMARY KEY (tenant_id, command_id),
       CONSTRAINT CK_driver_commands_json CHECK (ISJSON(result_json) = 1)
     );
   END`,
  `IF OBJECT_ID(N'dbo.notification_reads', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.notification_reads (
       tenant_id NVARCHAR(128) NOT NULL,
       user_id NVARCHAR(128) NOT NULL,
       notification_id NVARCHAR(160) NOT NULL,
       read_at DATETIME2(3) NOT NULL CONSTRAINT DF_notification_reads_read DEFAULT SYSUTCDATETIME(),
       CONSTRAINT PK_notification_reads PRIMARY KEY (tenant_id, user_id, notification_id)
     );
   END`,
  `IF OBJECT_ID(N'dbo.inventory_movements', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.inventory_movements (
       tenant_id NVARCHAR(128) NOT NULL,
       movement_id NVARCHAR(128) NOT NULL,
       idempotency_key NVARCHAR(200) NOT NULL,
       product_id NVARCHAR(128) NOT NULL,
       variant_id NVARCHAR(128) NOT NULL,
       movement_type NVARCHAR(40) NOT NULL,
       quantity_delta INT NOT NULL,
       created_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_inventory_movements PRIMARY KEY (tenant_id, movement_id),
       CONSTRAINT UQ_inventory_movements_key UNIQUE (tenant_id, idempotency_key),
       CONSTRAINT CK_inventory_movements_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_inventory_movements_variant ON dbo.inventory_movements(tenant_id, variant_id, created_at DESC);
   END`,
  `IF OBJECT_ID(N'dbo.return_cases', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.return_cases (
       tenant_id NVARCHAR(128) NOT NULL,
       return_id NVARCHAR(128) NOT NULL,
       order_id NVARCHAR(128) NOT NULL,
       order_number NVARCHAR(64) NOT NULL,
       return_status NVARCHAR(40) NOT NULL,
       created_at DATETIME2(3) NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_return_cases PRIMARY KEY (tenant_id, return_id),
       CONSTRAINT CK_return_cases_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_return_cases_order_status ON dbo.return_cases(tenant_id, order_id, return_status);
   END`,
  `IF OBJECT_ID(N'dbo.admin_tasks', N'U') IS NULL
   BEGIN
     CREATE TABLE dbo.admin_tasks (
       tenant_id NVARCHAR(128) NOT NULL,
       task_id NVARCHAR(128) NOT NULL,
       title NVARCHAR(240) NOT NULL,
       category NVARCHAR(40) NOT NULL,
       task_status NVARCHAR(40) NOT NULL,
       due_date DATE NULL,
       responsible_name NVARCHAR(160) NOT NULL,
       updated_at DATETIME2(3) NOT NULL,
       payload_json NVARCHAR(MAX) NOT NULL,
       CONSTRAINT PK_admin_tasks PRIMARY KEY (tenant_id, task_id),
       CONSTRAINT CK_admin_tasks_json CHECK (ISJSON(payload_json) = 1)
     );
     CREATE INDEX IX_admin_tasks_due ON dbo.admin_tasks(tenant_id, due_date, task_status);
   END`,
] as const;

export const SQLSERVER_VIEW_BATCHES = [
  `CREATE OR ALTER VIEW dbo.vw_order_operations AS
   SELECT tenant_id, order_id, order_number, order_status, source_channel,
          customer_name, customer_phone, currency_code, grand_total_minor,
          amount_due_minor, created_at, updated_at
   FROM dbo.orders`,
  `CREATE OR ALTER VIEW dbo.vw_cash_custody AS
   WITH movement_legs AS (
     SELECT tenant_id, currency_code, to_holder_id AS holder_id, amount_minor AS signed_minor
     FROM dbo.custody_movements WHERE to_holder_id IS NOT NULL
     UNION ALL
     SELECT tenant_id, currency_code, from_holder_id AS holder_id, -amount_minor AS signed_minor
     FROM dbo.custody_movements WHERE from_holder_id IS NOT NULL
   )
   SELECT tenant_id, currency_code, holder_id, SUM(signed_minor) AS balance_minor
   FROM movement_legs
   GROUP BY tenant_id, currency_code, holder_id
   HAVING SUM(signed_minor) <> 0`,
  `CREATE OR ALTER VIEW dbo.vw_delivery_performance AS
   SELECT tenant_id, resource_id, resource_name, delivery_status,
          COUNT_BIG(*) AS delivery_count,
          SUM(expected_collection_minor) AS expected_collection_minor
   FROM dbo.deliveries
   GROUP BY tenant_id, resource_id, resource_name, delivery_status`,
  `CREATE OR ALTER VIEW dbo.vw_payment_completion AS
   SELECT o.tenant_id, o.order_id, o.order_number, o.currency_code,
          o.grand_total_minor,
          COALESCE(SUM(CASE
            WHEN p.payment_status = N'POSTED' AND p.payment_type = N'COLLECTION' THEN p.amount_minor
            WHEN p.payment_status = N'POSTED' AND p.payment_type = N'REFUND' THEN -p.amount_minor
            ELSE 0 END), 0) AS net_collected_minor,
          CASE
            WHEN COALESCE(SUM(CASE
              WHEN p.payment_status = N'POSTED' AND p.payment_type = N'COLLECTION' THEN p.amount_minor
              WHEN p.payment_status = N'POSTED' AND p.payment_type = N'REFUND' THEN -p.amount_minor
              ELSE 0 END), 0) >= o.grand_total_minor THEN N'PAID'
            WHEN COALESCE(SUM(CASE
              WHEN p.payment_status = N'POSTED' AND p.payment_type = N'COLLECTION' THEN p.amount_minor
              WHEN p.payment_status = N'POSTED' AND p.payment_type = N'REFUND' THEN -p.amount_minor
              ELSE 0 END), 0) > 0 THEN N'PARTIALLY_PAID'
            ELSE N'PENDING' END AS payment_state
   FROM dbo.orders o
   LEFT JOIN dbo.payment_entries p
     ON p.tenant_id = o.tenant_id AND p.order_id = o.order_id
   GROUP BY o.tenant_id, o.order_id, o.order_number, o.currency_code, o.grand_total_minor`,
  `CREATE OR ALTER VIEW dbo.vw_product_variants AS
   SELECT p.tenant_id, p.product_id, p.product_name,
          JSON_VALUE(v.value, '$.id') AS variant_id,
          JSON_VALUE(v.value, '$.sku') AS sku,
          JSON_VALUE(v.value, '$.size') AS size,
          JSON_VALUE(v.value, '$.color') AS color,
          TRY_CONVERT(BIT, JSON_VALUE(v.value, '$.available')) AS is_available,
          TRY_CONVERT(INT, JSON_VALUE(v.value, '$.stockOnHand')) AS stock_on_hand,
          TRY_CONVERT(BIGINT, JSON_VALUE(v.value, '$.currentSellingPrice.amountMinor')) AS selling_amount_minor,
          JSON_VALUE(v.value, '$.currentSellingPrice.currency') AS selling_currency,
          TRY_CONVERT(BIGINT, JSON_VALUE(v.value, '$.currentUnitCost.amountMinor')) AS unit_cost_minor,
          JSON_VALUE(v.value, '$.currentUnitCost.currency') AS cost_currency,
          JSON_VALUE(v.value, '$.supplierId') AS supplier_id
   FROM dbo.products p
   CROSS APPLY OPENJSON(p.payload_json, '$.variants') v`,
  `CREATE OR ALTER VIEW dbo.vw_order_lines AS
   SELECT o.tenant_id, o.order_id, o.order_number,
          JSON_VALUE(line.value, '$.id') AS order_line_id,
          JSON_VALUE(line.value, '$.productId') AS product_id,
          JSON_VALUE(line.value, '$.variantId') AS variant_id,
          JSON_VALUE(line.value, '$.sku') AS sku,
          TRY_CONVERT(INT, JSON_VALUE(line.value, '$.quantity')) AS quantity,
          TRY_CONVERT(BIGINT, JSON_VALUE(line.value, '$.lineTotal.amountMinor')) AS line_total_minor,
          JSON_VALUE(line.value, '$.lineTotal.currency') AS currency_code
   FROM dbo.orders o
   CROSS APPLY OPENJSON(o.payload_json, '$.items') line`,
  `CREATE OR ALTER VIEW dbo.vw_customer_addresses AS
   SELECT c.tenant_id, c.customer_id, c.customer_name, c.phone_normalized,
          JSON_VALUE(address.value, '$.id') AS address_id,
          JSON_VALUE(address.value, '$.label') AS address_label,
          JSON_VALUE(address.value, '$.governorate') AS governorate,
          JSON_VALUE(address.value, '$.area') AS area,
          JSON_VALUE(address.value, '$.locality') AS locality,
          JSON_VALUE(address.value, '$.building') AS building,
          JSON_VALUE(address.value, '$.landmark') AS landmark
   FROM dbo.customers c
   CROSS APPLY OPENJSON(c.payload_json, '$.addresses') address`,
] as const;
