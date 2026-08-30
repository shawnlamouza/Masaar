import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig({
  AUTH_MODE: 'dev',
  MAASAR_ENV: 'test',
  WEB_ORIGIN: 'http://localhost:5173',
});

describe('Masaar API foundation', () => {
  it('signs Joe into the owner workspace from local role credentials', async () => {
    const app = await buildApp({ config });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: 'joe@masaar.demo', password: 'masaar-demo' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      accessToken: 'dev.owner',
      session: { displayName: 'Joe Haddad', role: 'OWNER' },
    });
    await app.close();
  });

  it('creates an empty company workspace and provisions role-scoped employee access', async () => {
    const app = await buildApp({ config });
    const email = `owner-${Date.now()}@example.test`;
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register-business',
      payload: {
        businessName: 'North Star Gifts',
        ownerName: 'Rana Saleh',
        email,
        password: 'StrongPass123',
      },
    });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().session).toMatchObject({ role: 'OWNER', onboardingRequired: true });
    const tenantId = registered.json().session.tenantId as string;
    const owner = {
      authorization: `Bearer ${registered.json().accessToken}`,
      'x-tenant-id': tenantId,
    };
    const [orders, products, fulfillment] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/orders', headers: owner }),
      app.inject({ method: 'GET', url: '/api/commerce/products', headers: owner }),
      app.inject({ method: 'GET', url: '/api/fulfillment/snapshot', headers: owner }),
    ]);
    expect(orders.json()).toEqual([]);
    expect(products.json()).toEqual([]);
    expect(fulfillment.json()).toMatchObject({ resources: [], zones: [], deliveries: [] });
    const employeeEmail = `employee-${Date.now()}@example.test`;
    const invited = await app.inject({
      method: 'POST',
      url: '/api/admin/invitations',
      headers: owner,
      payload: { displayName: 'Sami Employee', email: employeeEmail, role: 'EMPLOYEE' },
    });
    expect(invited.statusCode).toBe(201);
    const employeeSignIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      payload: { email: employeeEmail, password: invited.json().temporaryPassword },
    });
    expect(employeeSignIn.json().session).toMatchObject({ tenantId, role: 'EMPLOYEE' });
    await app.close();
  });

  it('configures a real delivery partner and Lebanese fee zone for a new company', async () => {
    const app = await buildApp({ config });
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register-business',
      payload: {
        businessName: 'Cedars Online',
        ownerName: 'Mona Tannous',
        email: `mona-${Date.now()}@example.test`,
        password: 'StrongPass123',
      },
    });
    const tenantId = registered.json().session.tenantId as string;
    const headers = {
      authorization: `Bearer ${registered.json().accessToken}`,
      'x-tenant-id': tenantId,
    };
    const resource = await app.inject({
      method: 'POST',
      url: '/api/fulfillment/resources',
      headers,
      payload: {
        name: 'North Express',
        type: 'COMPANY',
        phone: '+96170000111',
        active: true,
        serviceAreas: ['North Lebanon', 'Akkar'],
        settlementTerms: 'Weekly COD settlement',
      },
    });
    const zone = await app.inject({
      method: 'POST',
      url: '/api/fulfillment/zones',
      headers,
      payload: {
        name: 'North Coast',
        governorates: ['North Lebanon'],
        areas: ['Tripoli', 'Mina', 'Chekka'],
        customerFee: { amountMinor: 500, currency: 'USD' },
        businessCost: { amountMinor: 425, currency: 'USD' },
        estimatedDays: 2,
        active: true,
      },
    });
    expect(resource.statusCode).toBe(201);
    expect(zone.statusCode).toBe(201);
    const notifications = await app.inject({ method: 'GET', url: '/api/notifications', headers });
    expect(notifications.json().some((item: { id: string }) => item.id === 'setup-delivery')).toBe(
      false,
    );
    expect(notifications.json().some((item: { id: string }) => item.id === 'setup-catalog')).toBe(
      true,
    );
    await app.close();
  });

  it('exposes health without authentication', async () => {
    const app = await buildApp({ config });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
    await app.close();
  });

  it('rejects unauthenticated session requests', async () => {
    const app = await buildApp({ config });
    const response = await app.inject({ method: 'GET', url: '/api/session' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('builds a tenant-scoped owner session', async () => {
    const app = await buildApp({ config });
    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_a' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ tenantId: 'tenant_a', role: 'OWNER' });
    await app.close();
  });

  it('denies driver access to user invitations', async () => {
    const app = await buildApp({ config });
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/invitations',
      headers: { authorization: 'Bearer dev.driver', 'x-tenant-id': 'tenant_a' },
      payload: { email: 'employee@example.test', role: 'EMPLOYEE' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('keeps audit events inside the active tenant', async () => {
    const app = await buildApp({ config });
    const owner = { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_a' };
    await app.inject({
      method: 'POST',
      url: '/api/admin/invitations',
      headers: owner,
      payload: { email: 'employee@example.test', role: 'EMPLOYEE' },
    });
    const tenantA = await app.inject({ method: 'GET', url: '/api/audit', headers: owner });
    const tenantB = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_b' },
    });
    expect(tenantA.json()).toHaveLength(1);
    expect(tenantB.json()).toHaveLength(0);
    await app.close();
  });

  it('prevents an employee from changing owner business settings', async () => {
    const app = await buildApp({ config });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/foundation/settings',
      headers: { authorization: 'Bearer dev.employee', 'x-tenant-id': 'tenant_a' },
      payload: {
        businessName: 'Unsafe Update',
        baseCurrency: 'USD',
        enabledCurrencies: ['USD'],
        lowConnectivityMode: true,
      },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('stores owner settings only in the active tenant and audits the change', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_a' };
    const update = await app.inject({
      method: 'PUT',
      url: '/api/foundation/settings',
      headers,
      payload: {
        businessName: 'Beirut Studio',
        baseCurrency: 'USD',
        enabledCurrencies: ['USD', 'LBP'],
        lowConnectivityMode: true,
      },
    });
    const settings = await app.inject({ method: 'GET', url: '/api/foundation/settings', headers });
    const otherTenant = await app.inject({
      method: 'GET',
      url: '/api/foundation/settings',
      headers: { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_b' },
    });
    const audit = await app.inject({ method: 'GET', url: '/api/audit', headers });
    expect(update.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({ tenantId: 'tenant_a', businessName: 'Beirut Studio' });
    expect(otherTenant.json()).toMatchObject({
      tenantId: 'tenant_b',
      businessName: 'Cedar & Thread',
    });
    expect(audit.json()[0]).toMatchObject({ action: 'business.settings_updated' });
    await app.close();
  });

  it('serves tenant-scoped Lebanese catalog, supplier, customer, and FX seed data', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_a' };
    const [products, suppliers, customers, summary] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/commerce/products', headers }),
      app.inject({ method: 'GET', url: '/api/commerce/suppliers', headers }),
      app.inject({ method: 'GET', url: '/api/commerce/customers', headers }),
      app.inject({ method: 'GET', url: '/api/commerce/summary', headers }),
    ]);
    expect(products.statusCode).toBe(200);
    expect(products.json()[0]).toMatchObject({ tenantId: 'tenant_a' });
    expect(suppliers.json()).toHaveLength(2);
    expect(customers.json()[0].phoneNormalized).toMatch(/^\+961/);
    expect(summary.json()).toMatchObject({ activeProducts: 2, activeVariants: 3 });
    await app.close();
  });

  it('normalizes Lebanese phone numbers and prevents duplicate customer records', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.employee', 'x-tenant-id': 'tenant_a' };
    const review = await app.inject({
      method: 'GET',
      url: '/api/commerce/customers/duplicate-review?phone=70%20123%20456',
      headers,
    });
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/commerce/customers',
      headers,
      payload: {
        name: 'Jana duplicate',
        phoneOriginal: '00961 70 123 456',
        preferredPaymentMethod: 'CASH',
        addresses: [],
        tags: [],
        notes: '',
      },
    });
    expect(review.json()).toMatchObject({ normalizedPhone: '+96170123456', exactMatch: true });
    expect(review.json().matches).toHaveLength(1);
    expect(duplicate.statusCode).toBe(409);
    await app.close();
  });

  it('blocks employees from changing suppliers or approving prices', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.employee', 'x-tenant-id': 'tenant_a' };
    const response = await app.inject({
      method: 'POST',
      url: '/api/commerce/suppliers',
      headers,
      payload: {
        name: 'Unauthorized Supplier',
        contactName: '',
        leadTimeDays: 4,
        minimumOrderQuantity: 10,
        active: true,
      },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('rejects invalid catalog currencies and variant definitions', async () => {
    const app = await buildApp({ config });
    const response = await app.inject({
      method: 'POST',
      url: '/api/commerce/products',
      headers: { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_a' },
      payload: {
        name: 'Invalid item',
        category: 'Test',
        active: true,
        trackStock: true,
        variants: [
          {
            sku: 'bad sku',
            available: true,
            currentSellingPrice: { amountMinor: 10, currency: 'EUR' },
            currentUnitCost: { amountMinor: 5, currency: 'USD' },
          },
        ],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('edits master data without losing catalog history or customer operating statistics', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_master_edits' };
    const products = (
      await app.inject({ method: 'GET', url: '/api/commerce/products', headers })
    ).json();
    const product = products.find((item: { id: string }) => item.id === 'prd_linen_shirt');
    const updatedProduct = await app.inject({
      method: 'PUT',
      url: `/api/commerce/products/${product.id}`,
      headers,
      payload: {
        name: 'Premium Linen Shirt',
        category: product.category,
        active: product.active,
        trackStock: product.trackStock,
        variants: product.variants.map((variant: Record<string, unknown>, index: number) => ({
          id: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          available: index !== 1,
          stockOnHand: 999,
          currentSellingPrice:
            index === 0 ? { amountMinor: 3700, currency: 'USD' } : variant.currentSellingPrice,
          currentUnitCost: variant.currentUnitCost,
          supplierId: variant.supplierId,
        })),
      },
    });
    expect(updatedProduct.statusCode).toBe(200);
    expect(updatedProduct.json()).toMatchObject({ name: 'Premium Linen Shirt' });
    expect(updatedProduct.json().variants[0].priceHistory).toHaveLength(2);
    expect(updatedProduct.json().variants[0].stockOnHand).toBe(product.variants[0].stockOnHand);
    expect(updatedProduct.json().variants[1].available).toBe(false);

    const customers = (
      await app.inject({ method: 'GET', url: '/api/commerce/customers', headers })
    ).json();
    const customer = customers[0];
    const updatedCustomer = await app.inject({
      method: 'PUT',
      url: `/api/commerce/customers/${customer.id}`,
      headers,
      payload: {
        name: 'Jana Khoury Updated',
        phoneOriginal: '70 123 456',
        preferredPaymentMethod: 'CASH',
        addresses: customer.addresses.map(
          ({ id: _id, ...address }: Record<string, unknown>) => address,
        ),
        tags: [...customer.tags, 'verified'],
        notes: 'Call after 6 PM.',
      },
    });
    expect(updatedCustomer.statusCode).toBe(200);
    expect(updatedCustomer.json()).toMatchObject({
      name: 'Jana Khoury Updated',
      preferredPaymentMethod: 'CASH',
      orderStats: customer.orderStats,
    });

    const supplier = (
      await app.inject({ method: 'GET', url: '/api/commerce/suppliers', headers })
    ).json()[0];
    const updatedSupplier = await app.inject({
      method: 'PUT',
      url: `/api/commerce/suppliers/${supplier.id}`,
      headers,
      payload: {
        name: supplier.name,
        contactName: supplier.contactName,
        phone: supplier.phone,
        leadTimeDays: 9,
        minimumOrderQuantity: supplier.minimumOrderQuantity,
        lastPurchaseCost: supplier.lastPurchaseCost,
        active: false,
      },
    });
    expect(updatedSupplier.json()).toMatchObject({ leadTimeDays: 9, active: false });
    const audit = await app.inject({ method: 'GET', url: '/api/audit', headers });
    expect(audit.json().map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining(['catalog.product_updated', 'customer.updated', 'supplier.updated']),
    );
    await app.close();
  });

  it('edits delivery partners and multi-governorate zones with active-state controls', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_delivery_edits' };
    const snapshot = (
      await app.inject({ method: 'GET', url: '/api/fulfillment/snapshot', headers })
    ).json();
    const resource = snapshot.resources[1];
    const zone = snapshot.zones[0];
    const editedResource = await app.inject({
      method: 'PUT',
      url: `/api/fulfillment/resources/${resource.id}`,
      headers,
      payload: {
        name: 'Updated Courier',
        type: resource.type,
        phone: resource.phone,
        active: false,
        serviceAreas: ['Beirut', 'Nabatieh'],
        settlementTerms: 'COD handover every Monday',
      },
    });
    const editedZone = await app.inject({
      method: 'PUT',
      url: `/api/fulfillment/zones/${zone.id}`,
      headers,
      payload: {
        name: 'Greater Beirut',
        governorates: ['Beirut', 'Mount Lebanon'],
        areas: ['Beirut', 'Baabda', 'Metn'],
        customerFee: zone.customerFee,
        businessCost: zone.businessCost,
        estimatedDays: 2,
        active: true,
      },
    });
    expect(editedResource.statusCode).toBe(200);
    expect(editedResource.json()).toMatchObject({ name: 'Updated Courier', active: false });
    expect(editedZone.statusCode).toBe(200);
    expect(editedZone.json().governorates).toEqual(['Beirut', 'Mount Lebanon']);
    await app.close();
  });

  it('records supplier cost, previews margin damage, and approves selected prices without losing history', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_a' };
    const created = await app.inject({
      method: 'POST',
      url: '/api/commerce/price-reviews',
      headers,
      payload: {
        supplierId: 'sup_cedar_textiles',
        fxSnapshotId: 'fx_demo_89500',
        newUnitCost: { amountMinor: 2300, currency: 'USD' },
        targetMarginBps: 4000,
        effectiveAt: '2026-08-22T12:00:00.000Z',
        reason: 'Supplier quote increased',
      },
    });
    expect(created.statusCode).toBe(201);
    const review = created.json();
    expect(review.items).toHaveLength(2);
    expect(review.items[0].newMarginBps).toBeLessThan(review.items[0].oldMarginBps);

    const approved = await app.inject({
      method: 'POST',
      url: `/api/commerce/price-reviews/${review.id}/approve`,
      headers,
      payload: { itemIds: [review.items[0].id], reason: 'Approve one size first' },
    });
    expect(approved.json().status).toBe('PARTIALLY_APPROVED');

    const products = await app.inject({ method: 'GET', url: '/api/commerce/products', headers });
    const linen = products
      .json()
      .find((product: { id: string }) => product.id === 'prd_linen_shirt');
    const changed = linen.variants.find(
      (variant: { id: string }) => variant.id === review.items[0].variantId,
    );
    const unchanged = linen.variants.find(
      (variant: { id: string }) => variant.id === review.items[1].variantId,
    );
    expect(changed.costHistory).toHaveLength(2);
    expect(changed.priceHistory).toHaveLength(2);
    expect(unchanged.costHistory).toHaveLength(2);
    expect(unchanged.priceHistory).toHaveLength(1);
    await app.close();
  });

  it('creates a server-priced order and confirms structured delivery details through its public link', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.employee', 'x-tenant-id': 'tenant_phase4' };
    const created = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers,
      payload: {
        source: 'INSTAGRAM',
        customerName: 'Jana Khoury',
        customerPhone: '71 234 567',
        items: [{ variantId: 'var_linen_s_sand', quantity: 2 }],
        discountType: 'FIXED',
        discountValue: 500,
        deliveryFeeMinor: 400,
        prepaidMinor: 1000,
        paymentMethod: 'CASH',
        tags: ['instagram'],
        note: 'Gift wrap',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().order).toMatchObject({
      status: 'PENDING_CUSTOMER_CONFIRMATION',
      totals: {
        itemsSubtotal: { amountMinor: 7000, currency: 'USD' },
        grandTotal: { amountMinor: 6900, currency: 'USD' },
        amountDue: { amountMinor: 5900, currency: 'USD' },
      },
    });
    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/public/confirm/${created.json().confirmationToken}`,
      payload: {
        name: 'Jana Khoury',
        phone: '71 234 567',
        governorate: 'Mount Lebanon',
        area: 'Metn',
        locality: 'Antelias',
        street: 'Main Road',
        building: 'Cedar 4',
        floor: '2',
        landmark: 'Opposite the pharmacy',
        mapUrl: '',
        deliveryNotes: 'Call first',
      },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ status: 'CONFIRMED', customerName: 'Jana Khoury' });
    const internal = await app.inject({
      method: 'GET',
      url: `/api/orders/${created.json().order.id}`,
      headers,
    });
    expect(internal.json()).toMatchObject({
      deliveryAddress: { governorate: 'Mount Lebanon', locality: 'Antelias', building: 'Cedar 4' },
    });
    await app.close();
  });

  it('uses a selected LBP delivery zone as the authoritative server-side fee', async () => {
    const app = await buildApp({ config });
    const headers = {
      authorization: 'Bearer dev.owner',
      'x-tenant-id': 'tenant_lbp_zone_pricing',
    };
    const zone = await app.inject({
      method: 'POST',
      url: '/api/fulfillment/zones',
      headers,
      payload: {
        name: 'Lebanon LBP zone',
        governorates: ['Beirut', 'Mount Lebanon'],
        areas: ['Beirut', 'Metn'],
        customerFee: { amountMinor: 400000, currency: 'LBP' },
        businessCost: { amountMinor: 325000, currency: 'LBP' },
        estimatedDays: 1,
        active: true,
      },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers,
      payload: {
        source: 'WHATSAPP',
        customerName: 'Rita LBP',
        customerPhone: '71 888 777',
        items: [{ variantId: 'var_tote_navy', quantity: 1 }],
        discountType: 'FIXED',
        discountValue: 0,
        deliveryFeeMinor: 1,
        deliveryZoneId: zone.json().id,
        prepaidMinor: 0,
        paymentMethod: 'CASH',
        tags: [],
        note: '',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().order).toMatchObject({
      currency: 'LBP',
      deliveryZoneId: zone.json().id,
      totals: {
        deliveryFee: { amountMinor: 400000, currency: 'LBP' },
        grandTotal: { amountMinor: 2200000, currency: 'LBP' },
      },
    });
    await app.close();
  });

  it('warns about duplicate social orders and rejects illegal lifecycle jumps', async () => {
    const app = await buildApp({ config });
    const headers = { authorization: 'Bearer dev.employee', 'x-tenant-id': 'tenant_phase4_guard' };
    const payload = {
      source: 'WHATSAPP',
      customerName: 'Rita Nassar',
      customerPhone: '76 000 123',
      items: [{ variantId: 'var_linen_s_sand', quantity: 1 }],
      discountType: 'FIXED',
      discountValue: 0,
      deliveryFeeMinor: 0,
      prepaidMinor: 0,
      paymentMethod: 'CASH',
      tags: [],
      note: '',
    };
    const first = await app.inject({ method: 'POST', url: '/api/orders', headers, payload });
    const duplicate = await app.inject({ method: 'POST', url: '/api/orders', headers, payload });
    const illegal = await app.inject({
      method: 'POST',
      url: `/api/orders/${first.json().order.id}/transition`,
      headers,
      payload: { status: 'PACKED', reason: 'Skipped confirmation' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toBe('POSSIBLE_DUPLICATE');
    expect(illegal.statusCode).toBe(409);
    expect(illegal.json().error).toBe('ILLEGAL_TRANSITION');
    await app.close();
  });

  it('runs an idempotent delivery attempt while keeping payment separate', async () => {
    const app = await buildApp({ config });
    const tenant = 'tenant_phase5_delivery';
    const employee = { authorization: 'Bearer dev.employee', 'x-tenant-id': tenant };
    const driver = { authorization: 'Bearer dev.driver', 'x-tenant-id': tenant };
    const owner = { authorization: 'Bearer dev.owner', 'x-tenant-id': tenant };
    const assigned = await app.inject({
      method: 'POST',
      url: '/api/fulfillment/assignments',
      headers: employee,
      payload: { orderId: 'ord_demo_5', resourceId: 'usr_driver', zoneId: 'zone_metn' },
    });
    expect(assigned.statusCode).toBe(201);
    const deliveryId = assigned.json().id as string;
    const outCommand = {
      commandId: 'cmd-out-phase5-001',
      deliveryId,
      action: 'OUT_FOR_DELIVERY',
      occurredAt: '2026-08-23T10:00:00.000Z',
      note: 'Left the workshop',
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/driver/commands',
          headers: driver,
          payload: outCommand,
        })
      ).statusCode,
    ).toBe(200);
    const replay = await app.inject({
      method: 'POST',
      url: '/api/driver/commands',
      headers: driver,
      payload: outCommand,
    });
    expect(replay.json().replayed).toBe(true);
    const delivered = await app.inject({
      method: 'POST',
      url: '/api/driver/commands',
      headers: driver,
      payload: {
        commandId: 'cmd-delivered-phase5-001',
        deliveryId,
        action: 'DELIVERED',
        occurredAt: '2026-08-23T10:25:00.000Z',
        note: 'Customer accepted parcel',
        payment: { method: 'CASH', amountMinor: 2000, currency: 'USD', reference: 'COD partial' },
      },
    });
    expect(delivered.statusCode).toBe(200);
    const snapshot = await app.inject({
      method: 'GET',
      url: '/api/fulfillment/snapshot',
      headers: owner,
    });
    const body = snapshot.json();
    expect(
      body.payments.find((item: { orderId: string }) => item.orderId === 'ord_demo_5'),
    ).toMatchObject({ state: 'PARTIALLY_PAID' });
    expect(
      body.cashPositions.find((item: { holderId: string }) => item.holderId === 'usr_driver').amount
        .amountMinor,
    ).toBe(5900);
    const order = await app.inject({
      method: 'GET',
      url: '/api/orders/ord_demo_5',
      headers: owner,
    });
    expect(order.json().status).toBe('DELIVERED');
    await app.close();
  });

  it('requires failed-delivery reasons and preserves discrepancies for approval', async () => {
    const app = await buildApp({ config });
    const tenant = 'tenant_phase5_reconciliation';
    const driver = { authorization: 'Bearer dev.driver', 'x-tenant-id': tenant };
    const employee = { authorization: 'Bearer dev.employee', 'x-tenant-id': tenant };
    const owner = { authorization: 'Bearer dev.owner', 'x-tenant-id': tenant };
    const invalidFailure = await app.inject({
      method: 'POST',
      url: '/api/driver/commands',
      headers: driver,
      payload: {
        commandId: 'cmd-failed-phase5-001',
        deliveryId: 'del_demo_4',
        action: 'FAILED',
        occurredAt: '2026-08-23T11:00:00.000Z',
        note: '',
      },
    });
    expect(invalidFailure.statusCode).toBe(400);
    const reconciliation = await app.inject({
      method: 'POST',
      url: '/api/reconciliations',
      headers: employee,
      payload: {
        holderId: 'usr_driver',
        holderName: 'Karim Driver',
        currency: 'USD',
        returnedMinor: 3000,
        explanation: 'Driver used $9 for customer change and fuel.',
      },
    });
    expect(reconciliation.statusCode).toBe(201);
    expect(reconciliation.json()).toMatchObject({
      status: 'DISCREPANCY_REVIEW',
      expected: { amountMinor: 3900 },
      remaining: { amountMinor: 900 },
    });
    const denied = await app.inject({
      method: 'POST',
      url: `/api/reconciliations/${reconciliation.json().id}/approve`,
      headers: employee,
      payload: { reason: 'Employee tried approval' },
    });
    expect(denied.statusCode).toBe(403);
    const approved = await app.inject({
      method: 'POST',
      url: `/api/reconciliations/${reconciliation.json().id}/approve`,
      headers: owner,
      payload: { reason: 'Owner counted and accepted the partial return.' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe('APPROVED');
    const snapshot = await app.inject({
      method: 'GET',
      url: '/api/fulfillment/snapshot',
      headers: owner,
    });
    expect(
      snapshot
        .json()
        .cashPositions.find((item: { holderId: string }) => item.holderId === 'usr_driver').amount
        .amountMinor,
    ).toBe(900);
    await app.close();
  });

  it('derives available stock from opening, reservation, sale, receipt and cancellation movements', async () => {
    const app = await buildApp({ config });
    const tenant = 'tenant_phase6_inventory';
    const owner = { authorization: 'Bearer dev.owner', 'x-tenant-id': tenant };
    const employee = { authorization: 'Bearer dev.employee', 'x-tenant-id': tenant };
    const opening = await app.inject({
      method: 'GET',
      url: '/api/inventory/snapshot',
      headers: owner,
    });
    expect(opening.statusCode).toBe(200);
    expect(
      opening
        .json()
        .items.find((item: { variantId: string }) => item.variantId === 'var_linen_m_sand'),
    ).toMatchObject({ onHand: 4, reserved: 1, available: 3, state: 'LOW' });

    const receipt = await app.inject({
      method: 'POST',
      url: '/api/inventory/receipts',
      headers: employee,
      payload: {
        supplierId: 'sup_cedar_textiles',
        reference: 'INV-2026-118',
        receivedAt: '2026-08-24T08:00:00.000Z',
        items: [{ variantId: 'var_linen_m_sand', quantity: 2 }],
      },
    });
    expect(receipt.statusCode).toBe(201);
    expect(
      receipt
        .json()
        .items.find((item: { variantId: string }) => item.variantId === 'var_linen_m_sand'),
    ).toMatchObject({ onHand: 6, reserved: 1, available: 5 });

    const cancelled = await app.inject({
      method: 'POST',
      url: '/api/orders/ord_demo_1/transition',
      headers: employee,
      payload: { status: 'CANCELLED', reason: 'Customer cancelled before preparation.' },
    });
    expect(cancelled.statusCode).toBe(200);
    const after = await app.inject({
      method: 'GET',
      url: '/api/inventory/snapshot',
      headers: owner,
    });
    expect(
      after
        .json()
        .items.find((item: { variantId: string }) => item.variantId === 'var_linen_m_sand'),
    ).toMatchObject({ onHand: 6, reserved: 0, available: 6 });
    expect(
      after
        .json()
        .movements.some(
          (item: { type: string; sourceId: string }) =>
            item.type === 'RESERVATION_RELEASE' && item.sourceId === 'ord_demo_1',
        ),
    ).toBe(true);
    await app.close();
  });

  it('prevents two customer confirmations from consuming the same final units', async () => {
    const app = await buildApp({ config });
    const tenant = 'tenant_phase6_final_units';
    const employee = { authorization: 'Bearer dev.employee', 'x-tenant-id': tenant };
    const orderPayload = (phone: string) => ({
      source: 'WHATSAPP',
      customerName: 'Stock Test Customer',
      customerPhone: phone,
      items: [{ variantId: 'var_linen_m_sand', quantity: 3 }],
      discountType: 'FIXED',
      discountValue: 0,
      deliveryFeeMinor: 0,
      prepaidMinor: 0,
      paymentMethod: 'CASH',
      tags: [],
      note: '',
    });
    const first = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: employee,
      payload: orderPayload('70 900 001'),
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: employee,
      payload: orderPayload('70 900 002'),
    });
    const confirmation = (token: string, phone: string) =>
      app.inject({
        method: 'POST',
        url: `/api/public/confirm/${token}`,
        payload: {
          name: 'Stock Test Customer',
          phone,
          governorate: 'Beirut',
          area: 'Beirut',
          locality: 'Hamra',
          street: 'Main Street',
          building: 'Stock Building',
          floor: '1',
          landmark: 'Near the university',
          mapUrl: '',
          deliveryNotes: '',
        },
      });
    expect((await confirmation(first.json().confirmationToken, '70 900 001')).statusCode).toBe(200);
    const unavailable = await confirmation(second.json().confirmationToken, '70 900 002');
    expect(unavailable.statusCode).toBe(409);
    expect(unavailable.json().message).toContain('available');
    await app.close();
  });

  it('receives an exchange, protects sellable stock and creates a linked replacement order', async () => {
    const app = await buildApp({ config });
    const tenant = 'tenant_phase6_exchange';
    const employee = { authorization: 'Bearer dev.employee', 'x-tenant-id': tenant };
    const owner = { authorization: 'Bearer dev.owner', 'x-tenant-id': tenant };
    await app.inject({ method: 'GET', url: '/api/inventory/snapshot', headers: owner });
    const original = (
      await app.inject({ method: 'GET', url: '/api/orders/ord_demo_6', headers: employee })
    ).json();
    const opened = await app.inject({
      method: 'POST',
      url: '/api/returns',
      headers: employee,
      payload: {
        orderId: original.id,
        type: 'EXCHANGE',
        reason: 'WRONG_SIZE_OR_VARIANT',
        note: 'Customer needs size S.',
        items: [
          {
            orderLineId: original.items[0].id,
            quantity: 1,
            replacementVariantId: 'var_linen_s_sand',
          },
        ],
      },
    });
    expect(opened.statusCode).toBe(201);
    const received = await app.inject({
      method: 'POST',
      url: `/api/returns/${opened.json().id}/receive`,
      headers: employee,
      payload: {
        items: [
          {
            orderLineId: original.items[0].id,
            condition: 'SELLABLE',
            disposition: 'RESTOCK',
          },
        ],
        note: 'Clean and ready for resale.',
      },
    });
    expect(received.json().status).toBe('RECEIVED');
    const resolved = await app.inject({
      method: 'POST',
      url: `/api/returns/${opened.json().id}/resolve`,
      headers: owner,
      payload: { refundAmountMinor: 0, refundReference: 'Even exchange' },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({ status: 'RESOLVED' });
    expect(resolved.json().replacementOrderId).toBeTruthy();
    const replacement = await app.inject({
      method: 'GET',
      url: `/api/orders/${resolved.json().replacementOrderId}`,
      headers: owner,
    });
    expect(replacement.json()).toMatchObject({ status: 'CONFIRMED' });
    expect(replacement.json().tags).toContain('exchange');
    const snapshot = await app.inject({
      method: 'GET',
      url: '/api/inventory/snapshot',
      headers: owner,
    });
    expect(
      snapshot
        .json()
        .items.find((item: { variantId: string }) => item.variantId === 'var_linen_s_sand')
        .reserved,
    ).toBeGreaterThan(0);
    await app.close();
  });
});
