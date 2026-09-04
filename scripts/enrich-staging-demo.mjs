const base = (process.env.MASAAR_BASE_URL ?? 'https://d1liad8sdqnvdj.cloudfront.net').replace(/\/$/, '');
const password = process.env.MASAAR_DEMO_PASSWORD ?? 'Masaar-Demo1!';
const marker = 'cedar-week';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant_cedar_thread' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const value = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
  return value;
}

const owner = await request('/api/auth/sign-in', {
  method: 'POST', body: { email: 'joe@masaar.demo', password },
});
const driver = await request('/api/auth/sign-in', {
  method: 'POST', body: { email: 'driver@masaar.demo', password },
});
const token = owner.accessToken;

const [customers, products, fulfillment] = await Promise.all([
  request('/api/commerce/customers', { token }),
  request('/api/commerce/products', { token }),
  request('/api/fulfillment/snapshot', { token }),
]);
const variants = products.flatMap((product) =>
  product.variants.map((variant) => ({ ...variant, productName: product.name })),
);
const linkedDriver = fulfillment.resources.find((resource) => resource.id === driver.session.userId);
if (!linkedDriver) throw new Error('The linked internal driver is missing.');

const stories = [
  { customer: 'Jana Khoury', sku: 'TOTE-NAVY', quantity: 2, source: 'WHATSAPP', tags: ['repeat customer', marker] },
  { customer: 'Omar Saab', sku: 'LIN-M-SAND', quantity: 2, source: 'FACEBOOK', tags: ['high value', marker] },
  { customer: 'Tarek Nader', sku: 'CANDLE-CEDAR', quantity: 2, source: 'WEBSITE', tags: ['website conversion', marker] },
  { customer: 'Nour Haddad', sku: 'TOTE-NAVY', quantity: 2, source: 'TIKTOK', tags: ['repeat customer', marker] },
];

let orders = await request('/api/orders', { token });
for (const story of stories) {
  const customer = customers.find((item) => item.name === story.customer);
  const variant = variants.find((item) => item.sku === story.sku);
  if (!customer || !variant) throw new Error(`Missing demo data for ${story.customer}/${story.sku}.`);
  const address = customer.addresses[0];
  const zone = fulfillment.zones.find((item) => item.name === address.governorate);
  if (!zone) throw new Error(`No delivery zone matches ${address.governorate}.`);

  let order = orders.find((item) =>
    item.customerId === customer.id && item.tags.includes(marker) &&
    item.items.some((line) => line.variantId === variant.id),
  );
  if (!order) {
    const created = await request('/api/orders', { token, method: 'POST', body: {
      source: story.source,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phoneNormalized,
      items: [{ variantId: variant.id, quantity: story.quantity }],
      discountType: 'FIXED', discountValue: 0,
      deliveryFeeMinor: zone.customerFee.amountMinor,
      deliveryZoneId: zone.id, prepaidMinor: 0,
      paymentMethod: customer.preferredPaymentMethod,
      tags: story.tags,
      note: 'Repeat purchase captured through the weekly social-commerce campaign.',
      duplicateOverrideReason: 'Verified repeat purchase from a separate weekly campaign.',
    }});
    order = created.order;
  }

  if (order.status === 'PENDING_CUSTOMER_CONFIRMATION') {
    const message = await request(`/api/orders/${order.id}/message-template`, {
      token, method: 'POST', body: { template: 'CONFIRMATION' },
    });
    const confirmationToken = new URL(message.trackingUrl).pathname.split('/').at(-1);
    await request(`/api/public/confirm/${confirmationToken}`, { method: 'POST', body: {
      name: customer.name, phone: customer.phoneNormalized,
      governorate: address.governorate, area: address.area, locality: address.locality,
      street: address.street, building: address.building, floor: address.floor,
      landmark: address.landmark, mapUrl: address.mapUrl ?? '',
      deliveryNotes: 'Call before arriving.',
    }});
    order = (await request('/api/orders', { token })).find((item) => item.id === order.id);
  }

  for (const status of ['PREPARING', 'PACKED', 'READY_FOR_DISPATCH']) {
    if (order.status === status) continue;
    if (['ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)) break;
    order = await request(`/api/orders/${order.id}/transition`, {
      token, method: 'POST', body: { status, reason: 'Weekly fulfilled-order demonstration' },
    });
  }

  let deliveryCase = (await request('/api/fulfillment/snapshot', { token })).deliveries
    .find((item) => item.orderId === order.id && item.status !== 'CANCELLED');
  if (order.status === 'READY_FOR_DISPATCH') {
    deliveryCase = await request('/api/fulfillment/assignments', { token, method: 'POST', body: {
      orderId: order.id, resourceId: linkedDriver.id, zoneId: zone.id,
      reason: 'Weekly dispatch manifest',
    }});
    order = (await request('/api/orders', { token })).find((item) => item.id === order.id);
  }
  if (order.status === 'ASSIGNED_TO_DELIVERY') {
    await request('/api/driver/commands', { token: driver.accessToken, method: 'POST', body: {
      commandId: `growth-${order.id}-out`, deliveryId: deliveryCase.id,
      action: 'OUT_FOR_DELIVERY', occurredAt: new Date().toISOString(),
      note: 'Loaded and route started.',
    }});
    order = (await request('/api/orders', { token })).find((item) => item.id === order.id);
  }
  if (order.status === 'OUT_FOR_DELIVERY') {
    await request('/api/driver/commands', { token: driver.accessToken, method: 'POST', body: {
      commandId: `growth-${order.id}-done`, deliveryId: deliveryCase.id,
      action: 'DELIVERED', occurredAt: new Date().toISOString(), note: 'Delivered to customer.',
      payment: {
        method: customer.preferredPaymentMethod,
        amountMinor: order.totals.amountDue.amountMinor,
        currency: order.currency,
        reference: `${customer.preferredPaymentMethod}-${order.orderNumber}`,
        proofUrl: '',
      },
    }});
  }
}

orders = await request('/api/orders', { token });
const intelligence = await request('/api/intelligence/snapshot?period=30D', { token });
console.log(JSON.stringify({
  growthOrders: orders.filter((order) => order.tags.includes(marker)).length,
  deliveredGrowthOrders: orders.filter((order) => order.tags.includes(marker) && order.status === 'DELIVERED').length,
  intelligence,
}, null, 2));
