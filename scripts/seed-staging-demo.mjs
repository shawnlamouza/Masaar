const base = (process.env.MASAAR_BASE_URL ?? 'https://d1liad8sdqnvdj.cloudfront.net').replace(/\/$/, '');
const password = process.env.MASAAR_DEMO_PASSWORD ?? 'Masaar-Demo1!';

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

async function signIn(email) {
  return request('/api/auth/sign-in', { method: 'POST', body: { email, password } });
}

const owner = await signIn('joe@masaar.demo');
const driver = await signIn('driver@masaar.demo'); // Also provisions the linked internal-driver record.
const token = owner.accessToken;

await request('/api/foundation/settings', {
  token,
  method: 'PUT',
  body: {
    businessName: 'Cedar & Thread',
    baseCurrency: 'USD',
    enabledCurrencies: ['USD', 'LBP'],
    lowConnectivityMode: true,
  },
});

let suppliers = await request('/api/commerce/suppliers', { token });
async function ensureSupplier(input) {
  const current = suppliers.find((item) => item.name === input.name);
  if (current) return current;
  const created = await request('/api/commerce/suppliers', { token, method: 'POST', body: input });
  suppliers.push(created);
  return created;
}

const cedarTextiles = await ensureSupplier({
  name: 'Cedar Textiles', contactName: 'Hadi Nassar', phone: '+96170111444',
  leadTimeDays: 6, minimumOrderQuantity: 12,
  lastPurchaseCost: { amountMinor: 1800, currency: 'USD' }, active: true,
});
const beirutPrint = await ensureSupplier({
  name: 'Beirut Print House', contactName: 'Rita Haddad', phone: '+9613122255',
  leadTimeDays: 4, minimumOrderQuantity: 20,
  lastPurchaseCost: { amountMinor: 1100, currency: 'USD' }, active: true,
});

let products = await request('/api/commerce/products', { token });
async function ensureProduct(input) {
  const current = products.find((item) => item.name === input.name);
  if (current) return current;
  const created = await request('/api/commerce/products', { token, method: 'POST', body: input });
  products.push(created);
  return created;
}
const linen = await ensureProduct({
  name: 'Linen Shirt', category: 'Apparel', active: true, trackStock: true,
  variants: [
    { sku: 'LIN-S-SAND', size: 'S', color: 'Sand', available: true, stockOnHand: 28,
      currentSellingPrice: { amountMinor: 3500, currency: 'USD' }, currentUnitCost: { amountMinor: 1800, currency: 'USD' }, supplierId: cedarTextiles.id },
    { sku: 'LIN-M-SAND', size: 'M', color: 'Sand', available: true, stockOnHand: 21,
      currentSellingPrice: { amountMinor: 3500, currency: 'USD' }, currentUnitCost: { amountMinor: 1800, currency: 'USD' }, supplierId: cedarTextiles.id },
  ],
});
const tote = await ensureProduct({
  name: 'Beirut Line Tote', category: 'Accessories', active: true, trackStock: true,
  variants: [{ sku: 'TOTE-NAVY', color: 'Navy', available: true, stockOnHand: 35,
    currentSellingPrice: { amountMinor: 2400, currency: 'USD' }, currentUnitCost: { amountMinor: 1100, currency: 'USD' }, supplierId: beirutPrint.id }],
});
const candle = await ensureProduct({
  name: 'Cedars Scented Candle', category: 'Home', active: true, trackStock: true,
  variants: [{ sku: 'CANDLE-CEDAR', color: 'Forest Green', available: true, stockOnHand: 16,
    currentSellingPrice: { amountMinor: 2800, currency: 'USD' }, currentUnitCost: { amountMinor: 1250, currency: 'USD' }, supplierId: beirutPrint.id }],
});

let fx = await request('/api/commerce/fx-snapshots', { token });
if (!fx.length) {
  await request('/api/commerce/fx-snapshots', { token, method: 'POST', body: {
    lbpPerUsd: 89500, effectiveAt: new Date().toISOString(),
    note: 'Owner-entered operating reference for pricing decisions.',
  }});
}

let fulfillment = await request('/api/fulfillment/snapshot', { token });
async function ensureResource(input) {
  const current = fulfillment.resources.find((item) => item.name === input.name);
  if (current) return current;
  const created = await request('/api/fulfillment/resources', { token, method: 'POST', body: input });
  fulfillment.resources.push(created);
  return created;
}
await ensureResource({ name: 'Elias Mansour', type: 'FREELANCER', phone: '+96176111333', active: true,
  serviceAreas: ['Metn', 'Keserwan'], settlementTerms: 'Paid per completed stop' });
await ensureResource({ name: 'Beirut Express', type: 'COMPANY', phone: '+9611444555', active: true,
  serviceAreas: ['Lebanon'], settlementTerms: 'Weekly invoice and COD statement' });

const zoneInputs = [
  ['Beirut', ['Beirut'], ['Achrafieh', 'Hamra', 'Verdun', 'Mar Mikhael'], 300, 250, 1],
  ['Mount Lebanon', ['Mount Lebanon'], ['Antelias', 'Jdeideh', 'Broummana', 'Jounieh', 'Aley'], 450, 380, 1],
  ['North Lebanon', ['North Lebanon'], ['Tripoli', 'Zgharta', 'Batroun', 'Bcharre'], 600, 520, 2],
  ['Akkar', ['Akkar'], ['Halba', 'Qoubaiyat', 'Akkar El Atika'], 700, 610, 3],
  ['Bekaa', ['Bekaa'], ['Zahle', 'Chtaura', 'West Bekaa'], 650, 560, 2],
  ['Baalbek-Hermel', ['Baalbek-Hermel'], ['Baalbek', 'Hermel', 'Labweh'], 750, 660, 3],
  ['South Lebanon', ['South Lebanon'], ['Sidon', 'Tyre', 'Jezzine'], 650, 560, 2],
  ['Nabatieh', ['Nabatieh'], ['Nabatieh', 'Bint Jbeil', 'Marjayoun'], 700, 610, 3],
];
for (const [name, governorates, areas, customerFee, businessCost, estimatedDays] of zoneInputs) {
  if (fulfillment.zones.some((item) => item.name === name)) continue;
  const created = await request('/api/fulfillment/zones', { token, method: 'POST', body: {
    name, governorates, areas,
    customerFee: { amountMinor: customerFee, currency: 'USD' },
    businessCost: { amountMinor: businessCost, currency: 'USD' },
    estimatedDays, active: true,
  }});
  fulfillment.zones.push(created);
}

let customers = await request('/api/commerce/customers', { token });
const customerInputs = [
  ['Jana Khoury', '70 123 456', 'WHISH', 'Beirut', 'Achrafieh', 'Sassine'],
  ['Omar Saab', '03 445 566', 'CASH', 'Mount Lebanon', 'Metn', 'Sin El Fil'],
  ['Mira Fadel', '76 123 456', 'CASH', 'Beirut', 'Hamra', 'Clemenceau'],
  ['Tarek Nader', '81 234 567', 'OMT', 'Mount Lebanon', 'Metn', 'Antelias'],
  ['Rita Nassar', '76 222 111', 'CASH', 'North Lebanon', 'Tripoli', 'Mina'],
  ['Nour Haddad', '03 123 456', 'CASH', 'Beirut', 'Achrafieh', 'Mar Mikhael'],
  ['Lara Saad', '71 890 123', 'CARD', 'South Lebanon', 'Sidon', 'Old Souks'],
];
async function ensureCustomer([name, phoneOriginal, preferredPaymentMethod, governorate, area, locality]) {
  const current = customers.find((item) => item.name === name);
  if (current) return current;
  const created = await request('/api/commerce/customers', { token, method: 'POST', body: {
    name, phoneOriginal, preferredPaymentMethod,
    addresses: [{ label: 'Primary', governorate, area, locality, street: 'Main Road',
      building: 'Cedar Building', floor: '2', landmark: 'Near the pharmacy',
      originalWording: `${locality}, Main Road, Cedar Building, floor 2` }],
    tags: ['competition-demo'], notes: 'Call before delivery.',
  }});
  customers.push(created);
  return created;
}
for (const input of customerInputs) await ensureCustomer(input);

products = await request('/api/commerce/products', { token });
const variants = [linen, tote, candle].flatMap((product) => product.variants);
const zone = fulfillment.zones.find((item) => item.name === 'Beirut');
const linkedDriver = fulfillment.resources.find((item) => item.id === driver.session.userId);
if (!zone || !linkedDriver) throw new Error('The demo delivery zone or linked driver is missing.');

let orders = await request('/api/orders', { token });
const stories = [
  ['pending', 'Jana Khoury', variants[0].id, 'INSTAGRAM', 'PENDING'],
  ['confirmed', 'Omar Saab', variants[2].id, 'WHATSAPP', 'CONFIRMED'],
  ['preparing', 'Mira Fadel', variants[1].id, 'TIKTOK', 'PREPARING'],
  ['packed', 'Tarek Nader', variants[3].id, 'FACEBOOK', 'PACKED'],
  ['ready', 'Rita Nassar', variants[0].id, 'WHATSAPP', 'READY_FOR_DISPATCH'],
  ['delivered', 'Nour Haddad', variants[1].id, 'INSTAGRAM', 'DELIVERED'],
  ['failed', 'Lara Saad', variants[2].id, 'WEBSITE', 'FAILED'],
];
const transitionPath = ['PREPARING', 'PACKED', 'READY_FOR_DISPATCH'];
for (const [key, customerName, variantId, source, target] of stories) {
  if (orders.some((item) => item.tags.includes(`demo:${key}`))) continue;
  const customer = customers.find((item) => item.name === customerName);
  const created = await request('/api/orders', { token, method: 'POST', body: {
    source, customerId: customer.id, customerName: customer.name, customerPhone: customer.phoneNormalized,
    items: [{ variantId, quantity: 1 }], discountType: 'FIXED', discountValue: 0,
    deliveryFeeMinor: 300, deliveryZoneId: zone.id, prepaidMinor: 0,
    paymentMethod: customer.preferredPaymentMethod, tags: ['competition-demo', `demo:${key}`],
    note: 'Competition demonstration order.',
  }});
  let order;
  if (target === 'PENDING') continue;
  await request(`/api/public/confirm/${created.confirmationToken}`, { method: 'POST', body: {
    name: customer.name, phone: customer.phoneNormalized,
    governorate: customer.addresses[0].governorate, area: customer.addresses[0].area,
    locality: customer.addresses[0].locality, street: customer.addresses[0].street,
    building: customer.addresses[0].building, floor: customer.addresses[0].floor,
    landmark: customer.addresses[0].landmark, mapUrl: '', deliveryNotes: 'Call before arriving.',
  }});
  order = (await request('/api/orders', { token })).find((item) => item.id === created.order.id);
  if (!order) throw new Error(`Confirmed order ${created.order.id} could not be reloaded.`);
  if (target === 'CONFIRMED') continue;
  for (const status of transitionPath) {
    order = await request(`/api/orders/${order.id}/transition`, { token, method: 'POST', body: {
      status, reason: 'Competition demo workflow',
    }});
    if (status === target) break;
  }
  if (!['DELIVERED', 'FAILED'].includes(target)) continue;
  const delivery = await request('/api/fulfillment/assignments', { token, method: 'POST', body: {
    orderId: order.id, resourceId: linkedDriver.id, zoneId: zone.id, reason: 'Morning demo dispatch',
  }});
  const now = new Date().toISOString();
  await request('/api/driver/commands', { token: driver.accessToken, method: 'POST', body: {
    commandId: `seed-${key}-out`, deliveryId: delivery.id, action: 'OUT_FOR_DELIVERY',
    occurredAt: now, note: 'Loaded and route started.',
  }});
  await request('/api/driver/commands', { token: driver.accessToken, method: 'POST', body: target === 'DELIVERED' ? {
    commandId: `seed-${key}-done`, deliveryId: delivery.id, action: 'DELIVERED',
    occurredAt: new Date().toISOString(), note: 'Delivered to customer.',
    payment: { method: 'CASH', amountMinor: order.totals.amountDue.amountMinor,
      currency: order.currency, reference: `COD-${order.orderNumber}`, proofUrl: '' },
  } : {
    commandId: `seed-${key}-failed`, deliveryId: delivery.id, action: 'FAILED',
    occurredAt: new Date().toISOString(), failureReason: 'INCORRECT_ADDRESS',
    note: 'Building could not be identified; customer follow-up required.',
  }});
}

const finalOrders = await request('/api/orders', { token });
const finalFulfillment = await request('/api/fulfillment/snapshot', { token });
console.log(JSON.stringify({
  products: products.length,
  customers: customers.length,
  orders: finalOrders.length,
  zones: finalFulfillment.zones.length,
  resources: finalFulfillment.resources.length,
  deliveries: finalFulfillment.deliveries.length,
  payments: finalFulfillment.payments.filter((item) => item.entries.length).length,
}, null, 2));
