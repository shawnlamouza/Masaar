/* Masaar SQL Server schema.
   Run in the target database from SQL Server Management Studio (SSMS).
   The API also applies the same idempotent schema at startup. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.business_settings', N'U') IS NULL
CREATE TABLE dbo.business_settings (
  tenant_id NVARCHAR(128) NOT NULL PRIMARY KEY,
  business_name NVARCHAR(200) NOT NULL,
  updated_at DATETIME2(3) NOT NULL,
  payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1)
);

IF OBJECT_ID(N'dbo.audit_events', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_events (
    event_id NVARCHAR(128) NOT NULL PRIMARY KEY,
    tenant_id NVARCHAR(128) NOT NULL,
    actor_id NVARCHAR(128) NOT NULL,
    actor_role NVARCHAR(32) NOT NULL,
    action_name NVARCHAR(160) NOT NULL,
    entity_type NVARCHAR(100) NOT NULL,
    entity_id NVARCHAR(128) NOT NULL,
    occurred_at DATETIME2(3) NOT NULL,
    correlation_id NVARCHAR(128) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1)
  );
  CREATE INDEX IX_audit_events_tenant_time ON dbo.audit_events(tenant_id, occurred_at DESC);
END;

IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.products (
    tenant_id NVARCHAR(128) NOT NULL,
    product_id NVARCHAR(128) NOT NULL,
    product_name NVARCHAR(200) NOT NULL,
    category NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL,
    tracks_stock BIT NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_products PRIMARY KEY (tenant_id, product_id)
  );
  CREATE INDEX IX_products_tenant_name ON dbo.products(tenant_id, product_name);
END;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.suppliers (
    tenant_id NVARCHAR(128) NOT NULL,
    supplier_id NVARCHAR(128) NOT NULL,
    supplier_name NVARCHAR(200) NOT NULL,
    phone NVARCHAR(40) NOT NULL,
    is_active BIT NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_suppliers PRIMARY KEY (tenant_id, supplier_id)
  );
  CREATE INDEX IX_suppliers_tenant_name ON dbo.suppliers(tenant_id, supplier_name);
END;

IF OBJECT_ID(N'dbo.customers', N'U') IS NULL
CREATE TABLE dbo.customers (
  tenant_id NVARCHAR(128) NOT NULL,
  customer_id NVARCHAR(128) NOT NULL,
  customer_name NVARCHAR(200) NOT NULL,
  phone_normalized NVARCHAR(40) NOT NULL,
  preferred_payment_method NVARCHAR(32) NOT NULL,
  updated_at DATETIME2(3) NOT NULL,
  payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
  CONSTRAINT PK_customers PRIMARY KEY (tenant_id, customer_id),
  CONSTRAINT UQ_customers_tenant_phone UNIQUE (tenant_id, phone_normalized)
);

IF OBJECT_ID(N'dbo.fx_snapshots', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.fx_snapshots (
    tenant_id NVARCHAR(128) NOT NULL,
    snapshot_id NVARCHAR(128) NOT NULL,
    lbp_per_usd DECIMAL(19,4) NOT NULL,
    effective_at DATETIME2(3) NOT NULL,
    source_name NVARCHAR(64) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_fx_snapshots PRIMARY KEY (tenant_id, snapshot_id)
  );
  CREATE INDEX IX_fx_snapshots_tenant_time ON dbo.fx_snapshots(tenant_id, effective_at DESC);
END;

IF OBJECT_ID(N'dbo.price_reviews', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.price_reviews (
    tenant_id NVARCHAR(128) NOT NULL,
    review_id NVARCHAR(128) NOT NULL,
    product_id NVARCHAR(128) NOT NULL,
    variant_id NVARCHAR(128) NOT NULL,
    review_status NVARCHAR(40) NOT NULL,
    created_at DATETIME2(3) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_price_reviews PRIMARY KEY (tenant_id, review_id)
  );
  CREATE INDEX IX_price_reviews_tenant_time ON dbo.price_reviews(tenant_id, created_at DESC);
END;

IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
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
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_orders PRIMARY KEY (tenant_id, order_id),
    CONSTRAINT UQ_orders_tenant_number UNIQUE (tenant_id, order_number)
  );
  CREATE UNIQUE INDEX UX_orders_confirmation_hash ON dbo.orders(confirmation_hash) WHERE confirmation_hash IS NOT NULL;
  CREATE INDEX IX_orders_tenant_status_time ON dbo.orders(tenant_id, order_status, updated_at DESC);
  CREATE INDEX IX_orders_tenant_customer_phone ON dbo.orders(tenant_id, customer_phone);
END;

IF OBJECT_ID(N'dbo.delivery_resources', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.delivery_resources (
    tenant_id NVARCHAR(128) NOT NULL,
    resource_id NVARCHAR(128) NOT NULL,
    resource_name NVARCHAR(200) NOT NULL,
    resource_type NVARCHAR(40) NOT NULL,
    phone NVARCHAR(40) NOT NULL,
    is_active BIT NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_delivery_resources PRIMARY KEY (tenant_id, resource_id)
  );
  CREATE INDEX IX_delivery_resources_tenant_type ON dbo.delivery_resources(tenant_id, resource_type, is_active);
END;

IF OBJECT_ID(N'dbo.delivery_zones', N'U') IS NULL
CREATE TABLE dbo.delivery_zones (
  tenant_id NVARCHAR(128) NOT NULL,
  zone_id NVARCHAR(128) NOT NULL,
  zone_name NVARCHAR(200) NOT NULL,
  customer_fee_minor BIGINT NOT NULL,
  business_cost_minor BIGINT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  is_active BIT NOT NULL,
  payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
  CONSTRAINT PK_delivery_zones PRIMARY KEY (tenant_id, zone_id)
);

IF OBJECT_ID(N'dbo.deliveries', N'U') IS NULL
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
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_deliveries PRIMARY KEY (tenant_id, delivery_id)
  );
  CREATE INDEX IX_deliveries_tenant_order ON dbo.deliveries(tenant_id, order_id, updated_at DESC);
  CREATE INDEX IX_deliveries_tenant_resource_status ON dbo.deliveries(tenant_id, resource_id, delivery_status);
END;

IF OBJECT_ID(N'dbo.payment_entries', N'U') IS NULL
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
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_payment_entries PRIMARY KEY (tenant_id, payment_id)
  );
  CREATE INDEX IX_payment_entries_tenant_order ON dbo.payment_entries(tenant_id, order_id, occurred_at DESC);
END;

IF OBJECT_ID(N'dbo.custody_movements', N'U') IS NULL
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
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_custody_movements PRIMARY KEY (tenant_id, movement_id)
  );
  CREATE INDEX IX_custody_tenant_holders ON dbo.custody_movements(tenant_id, to_holder_id, from_holder_id, occurred_at DESC);
END;

IF OBJECT_ID(N'dbo.reconciliations', N'U') IS NULL
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
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_reconciliations PRIMARY KEY (tenant_id, reconciliation_id)
  );
  CREATE INDEX IX_reconciliations_tenant_status ON dbo.reconciliations(tenant_id, reconciliation_status, created_at DESC);
END;

IF OBJECT_ID(N'dbo.driver_commands', N'U') IS NULL
CREATE TABLE dbo.driver_commands (
  tenant_id NVARCHAR(128) NOT NULL,
  command_id NVARCHAR(128) NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  result_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(result_json) = 1),
  CONSTRAINT PK_driver_commands PRIMARY KEY (tenant_id, command_id)
);

IF OBJECT_ID(N'dbo.notification_reads', N'U') IS NULL
CREATE TABLE dbo.notification_reads (
  tenant_id NVARCHAR(128) NOT NULL,
  user_id NVARCHAR(128) NOT NULL,
  notification_id NVARCHAR(160) NOT NULL,
  read_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_notification_reads PRIMARY KEY (tenant_id, user_id, notification_id)
);

IF OBJECT_ID(N'dbo.inventory_movements', N'U') IS NULL
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
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_inventory_movements PRIMARY KEY (tenant_id, movement_id),
    CONSTRAINT UQ_inventory_movements_key UNIQUE (tenant_id, idempotency_key)
  );
  CREATE INDEX IX_inventory_movements_variant ON dbo.inventory_movements(tenant_id, variant_id, created_at DESC);
END;

IF OBJECT_ID(N'dbo.return_cases', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.return_cases (
    tenant_id NVARCHAR(128) NOT NULL,
    return_id NVARCHAR(128) NOT NULL,
    order_id NVARCHAR(128) NOT NULL,
    order_number NVARCHAR(64) NOT NULL,
    return_status NVARCHAR(40) NOT NULL,
    created_at DATETIME2(3) NOT NULL,
    updated_at DATETIME2(3) NOT NULL,
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_return_cases PRIMARY KEY (tenant_id, return_id)
  );
  CREATE INDEX IX_return_cases_order_status ON dbo.return_cases(tenant_id, order_id, return_status);
END;

IF OBJECT_ID(N'dbo.admin_tasks', N'U') IS NULL
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
    payload_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(payload_json) = 1),
    CONSTRAINT PK_admin_tasks PRIMARY KEY (tenant_id, task_id)
  );
  CREATE INDEX IX_admin_tasks_due ON dbo.admin_tasks(tenant_id, due_date, task_status);
END;

COMMIT TRANSACTION;
