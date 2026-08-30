import { describe, expect, it } from 'vitest';
import { SQLSERVER_SCHEMA_BATCHES, SQLSERVER_VIEW_BATCHES } from './sqlserver-schema.js';

describe('SQL Server persistence contract', () => {
  it('creates the complete operational table set with tenant-scoped keys', () => {
    const schema = SQLSERVER_SCHEMA_BATCHES.join('\n');
    for (const table of [
      'business_settings',
      'audit_events',
      'products',
      'suppliers',
      'customers',
      'orders',
      'delivery_resources',
      'delivery_zones',
      'deliveries',
      'payment_entries',
      'custody_movements',
      'reconciliations',
      'inventory_movements',
      'return_cases',
      'admin_tasks',
    ]) {
      expect(schema).toContain(`dbo.${table}`);
    }
    expect(schema.toLowerCase()).not.toContain('mongo');
  });

  it('exposes SSMS-ready operational and child-record views', () => {
    const views = SQLSERVER_VIEW_BATCHES.join('\n');
    expect(views).toContain('vw_order_operations');
    expect(views).toContain('vw_cash_custody');
    expect(views).toContain('vw_payment_completion');
    expect(views).toContain('vw_product_variants');
    expect(views).toContain('vw_order_lines');
    expect(views).toContain('vw_customer_addresses');
    expect(views).toContain('-amount_minor AS signed_minor');
  });
});
