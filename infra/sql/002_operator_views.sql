/* Readable operational views for SSMS, reporting, and judge demonstrations. */
CREATE OR ALTER VIEW dbo.vw_order_operations AS
SELECT tenant_id, order_id, order_number, order_status, source_channel,
       customer_name, customer_phone, currency_code, grand_total_minor,
       amount_due_minor, created_at, updated_at
FROM dbo.orders;
GO

CREATE OR ALTER VIEW dbo.vw_cash_custody AS
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
HAVING SUM(signed_minor) <> 0;
GO

CREATE OR ALTER VIEW dbo.vw_delivery_performance AS
SELECT tenant_id, resource_id, resource_name, delivery_status,
       COUNT_BIG(*) AS delivery_count,
       SUM(expected_collection_minor) AS expected_collection_minor
FROM dbo.deliveries
GROUP BY tenant_id, resource_id, resource_name, delivery_status;
GO

CREATE OR ALTER VIEW dbo.vw_payment_completion AS
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
GROUP BY o.tenant_id, o.order_id, o.order_number, o.currency_code, o.grand_total_minor;
GO

CREATE OR ALTER VIEW dbo.vw_product_variants AS
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
CROSS APPLY OPENJSON(p.payload_json, '$.variants') v;
GO

CREATE OR ALTER VIEW dbo.vw_order_lines AS
SELECT o.tenant_id, o.order_id, o.order_number,
       JSON_VALUE(line.value, '$.id') AS order_line_id,
       JSON_VALUE(line.value, '$.productId') AS product_id,
       JSON_VALUE(line.value, '$.variantId') AS variant_id,
       JSON_VALUE(line.value, '$.sku') AS sku,
       TRY_CONVERT(INT, JSON_VALUE(line.value, '$.quantity')) AS quantity,
       TRY_CONVERT(BIGINT, JSON_VALUE(line.value, '$.lineTotal.amountMinor')) AS line_total_minor,
       JSON_VALUE(line.value, '$.lineTotal.currency') AS currency_code
FROM dbo.orders o
CROSS APPLY OPENJSON(o.payload_json, '$.items') line;
GO

CREATE OR ALTER VIEW dbo.vw_customer_addresses AS
SELECT c.tenant_id, c.customer_id, c.customer_name, c.phone_normalized,
       JSON_VALUE(address.value, '$.id') AS address_id,
       JSON_VALUE(address.value, '$.label') AS address_label,
       JSON_VALUE(address.value, '$.governorate') AS governorate,
       JSON_VALUE(address.value, '$.area') AS area,
       JSON_VALUE(address.value, '$.locality') AS locality,
       JSON_VALUE(address.value, '$.building') AS building,
       JSON_VALUE(address.value, '$.landmark') AS landmark
FROM dbo.customers c
CROSS APPLY OPENJSON(c.payload_json, '$.addresses') address;
GO
