import {
  actionCardSchema,
  businessSettingsSchema,
  teamMemberSchema,
  teamInvitationResponseSchema,
  notificationSchema,
  deliveryResourceSchema,
  deliveryZoneSchema,
  commerceSummarySchema,
  customerSchema,
  duplicateCustomerReviewSchema,
  fxSnapshotSchema,
  priceReviewSchema,
  productSchema,
  orderSchema,
  publicOrderSchema,
  quickOrderResponseSchema,
  sessionSchema,
  signInResponseSchema,
  supplierSchema,
  fulfillmentSnapshotSchema,
  deliveryCaseSchema,
  driverStopSchema,
  cashPositionSchema,
  paymentEntrySchema,
  reconciliationSchema,
  inventorySnapshotSchema,
  returnCaseSchema,
  intelligenceSnapshotSchema,
  predictiveSnapshotSchema,
  assistantResponseSchema,
  expansionSnapshotSchema,
  adminTaskSchema,
  type ActionCard,
  type BusinessSettings,
  type CreateDeliveryResource,
  type CreateDeliveryZone,
  type UpdateDeliveryResource,
  type UpdateDeliveryZone,
  type InviteTeamMember,
  type Notification,
  type RegisterBusiness,
  type TeamMember,
  type UpdateBusinessSettings,
  type ApprovePriceReview,
  type CommerceSummary,
  type CreateCustomer,
  type CreateFxSnapshot,
  type CreateProduct,
  type CreateSupplier,
  type CreateSupplierCostReview,
  type UpdateCustomer,
  type UpdateProduct,
  type UpdateSupplier,
  type Customer,
  type DuplicateCustomerReview,
  type FxSnapshot,
  type PriceReview,
  type Product,
  type Order,
  type OrderStatus,
  type PublicOrder,
  type QuickOrder,
  type QuickOrderResponse,
  type Role,
  type Session,
  type Supplier,
  type AssignDelivery,
  type CashPosition,
  type CreateReconciliation,
  type DriverCommand,
  type DriverStop,
  type FulfillmentSnapshot,
  type PaymentEntry,
  type RecordPayment,
  type Reconciliation,
  type InventorySnapshot,
  type RecordStockReceipt,
  type AdjustStock,
  type CreateReturnCase,
  type ReceiveReturnCase,
  type ResolveReturnCase,
  type ReturnCase,
  type IntelligencePeriod,
  type IntelligenceSnapshot,
  type PredictiveSnapshot,
  type AssistantResponse,
  type ExpansionSnapshot,
  type CreateAdminTask,
  type UpdateAdminTask,
  type AdminTask,
} from '@masaar/contracts';

export type AuthSession = { accessToken: string; session: Session };
let activeAuth: AuthSession | null = null;

export function setApiAuth(auth: AuthSession | null) {
  activeAuth = auth;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: Record<string, unknown>,
  ) {
    super(message);
  }
}

const TOKENS: Partial<Record<Role, string>> = {
  OWNER: 'dev.owner',
  MANAGER: 'dev.manager',
  EMPLOYEE: 'dev.employee',
  DRIVER: 'dev.driver',
};

const DEV_AUTH_ENABLED =
  import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test';

function headers(role: Role) {
  const accessToken = activeAuth?.accessToken ?? (DEV_AUTH_ENABLED ? TOKENS[role] : null);
  if (!accessToken) throw new Error('A signed-in Masaar session is required.');
  return {
    Authorization: `Bearer ${accessToken}`,
    'x-tenant-id': activeAuth?.session.tenantId ?? 'tenant_cedar_thread',
  };
}

async function requestJson(path: string, role: Role, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    headers: { ...headers(role), ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      typeof error.message === 'string' ? error.message : `Masaar API returned ${response.status}`,
      response.status,
      error,
    );
  }
  const value = await response.json();
  if ((init?.method ?? 'GET').toUpperCase() !== 'GET') {
    window.dispatchEvent(
      new CustomEvent('masaar:data-changed', {
        detail: { path, method: (init?.method ?? 'GET').toUpperCase() },
      }),
    );
  }
  return value;
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const response = await fetch('/api/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(value.message ?? 'Sign-in failed.', response.status, value);
  return signInResponseSchema.parse(value);
}

export async function registerBusiness(input: RegisterBusiness): Promise<AuthSession> {
  const response = await fetch('/api/auth/register-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(value.message ?? 'Business registration failed.', response.status, value);
  return signInResponseSchema.parse(value);
}

async function getJson(path: string, role: Role) {
  return requestJson(path, role);
}

export async function getSession(role: Role): Promise<Session> {
  return sessionSchema.parse(await getJson('/api/session', role));
}

export async function getActionCards(role: Role): Promise<ActionCard[]> {
  const value = await getJson('/api/foundation/action-cards', role);
  return actionCardSchema.array().parse(value);
}

export async function getNotifications(role: Role): Promise<Notification[]> {
  return notificationSchema.array().parse(await getJson('/api/notifications', role));
}

export async function markNotificationRead(role: Role, id: string) {
  return requestJson(`/api/notifications/${id}/read`, role, { method: 'POST' });
}

export async function getBusinessSettings(role: Role): Promise<BusinessSettings> {
  return businessSettingsSchema.parse(await getJson('/api/foundation/settings', role));
}

export async function updateBusinessSettings(
  role: Role,
  input: UpdateBusinessSettings,
): Promise<BusinessSettings> {
  return businessSettingsSchema.parse(
    await requestJson('/api/foundation/settings', role, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

export async function getTeam(role: Role): Promise<TeamMember[]> {
  return teamMemberSchema.array().parse(await getJson('/api/admin/team', role));
}

export async function inviteTeamMember(role: Role, input: InviteTeamMember) {
  return teamInvitationResponseSchema.parse(
    await requestJson('/api/admin/invitations', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function getExpansionSnapshot(role: Role): Promise<ExpansionSnapshot> {
  return expansionSnapshotSchema.parse(await getJson('/api/expansion/snapshot', role));
}

export async function createAdminTask(role: Role, input: CreateAdminTask): Promise<AdminTask> {
  return adminTaskSchema.parse(
    await requestJson('/api/expansion/admin-tasks', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateAdminTask(
  role: Role,
  id: string,
  input: UpdateAdminTask,
): Promise<AdminTask> {
  return adminTaskSchema.parse(
    await requestJson(`/api/expansion/admin-tasks/${id}`, role, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export type CommerceSnapshot = {
  summary: CommerceSummary;
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  fxSnapshots: FxSnapshot[];
  priceReviews: PriceReview[];
};

export async function getCommerceSnapshot(role: Role): Promise<CommerceSnapshot> {
  const [summary, products, suppliers, customers, fxSnapshots, priceReviews, inventory] =
    await Promise.all([
      getJson('/api/commerce/summary', role),
      getJson('/api/commerce/products', role),
      getJson('/api/commerce/suppliers', role),
      getJson('/api/commerce/customers', role),
      getJson('/api/commerce/fx-snapshots', role),
      getJson('/api/commerce/price-reviews', role),
      getJson('/api/inventory/snapshot', role),
    ]);
  const parsedInventory = inventorySnapshotSchema.parse(inventory);
  const stockByVariant = new Map(
    parsedInventory.items.map((item) => [item.variantId, item.onHand] as const),
  );
  const parsedProducts = productSchema
    .array()
    .parse(products)
    .map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        ...(product.trackStock && stockByVariant.has(variant.id)
          ? { stockOnHand: stockByVariant.get(variant.id) }
          : {}),
      })),
    }));
  const parsedSummary = commerceSummarySchema.parse(summary);
  return {
    summary: {
      ...parsedSummary,
      lowStockVariants:
        parsedInventory.summary.lowStockVariants + parsedInventory.summary.outOfStockVariants,
    },
    products: productSchema.array().parse(parsedProducts),
    suppliers: supplierSchema.array().parse(suppliers),
    customers: customerSchema.array().parse(customers),
    fxSnapshots: fxSnapshotSchema.array().parse(fxSnapshots),
    priceReviews: priceReviewSchema.array().parse(priceReviews),
  };
}

export async function createProduct(role: Role, input: CreateProduct) {
  return productSchema.parse(
    await requestJson('/api/commerce/products', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateProduct(role: Role, id: string, input: UpdateProduct) {
  return productSchema.parse(
    await requestJson(`/api/commerce/products/${encodeURIComponent(id)}`, role, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

export async function createSupplier(role: Role, input: CreateSupplier) {
  return supplierSchema.parse(
    await requestJson('/api/commerce/suppliers', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateSupplier(role: Role, id: string, input: UpdateSupplier) {
  return supplierSchema.parse(
    await requestJson(`/api/commerce/suppliers/${encodeURIComponent(id)}`, role, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

export async function reviewDuplicateCustomer(
  role: Role,
  phone: string,
): Promise<DuplicateCustomerReview> {
  return duplicateCustomerReviewSchema.parse(
    await getJson(
      `/api/commerce/customers/duplicate-review?phone=${encodeURIComponent(phone)}`,
      role,
    ),
  );
}

export async function createCustomer(role: Role, input: CreateCustomer) {
  return customerSchema.parse(
    await requestJson('/api/commerce/customers', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateCustomer(role: Role, id: string, input: UpdateCustomer) {
  return customerSchema.parse(
    await requestJson(`/api/commerce/customers/${encodeURIComponent(id)}`, role, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

export async function createFxSnapshot(role: Role, input: CreateFxSnapshot) {
  return fxSnapshotSchema.parse(
    await requestJson('/api/commerce/fx-snapshots', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function createPriceReview(role: Role, input: CreateSupplierCostReview) {
  return priceReviewSchema.parse(
    await requestJson('/api/commerce/price-reviews', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function approvePriceReview(role: Role, id: string, input: ApprovePriceReview) {
  return priceReviewSchema.parse(
    await requestJson(`/api/commerce/price-reviews/${id}/approve`, role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function listOrders(role: Role, search = ''): Promise<Order[]> {
  return orderSchema
    .array()
    .parse(
      await getJson(`/api/orders${search ? `?search=${encodeURIComponent(search)}` : ''}`, role),
    );
}

export async function createOrder(role: Role, input: QuickOrder): Promise<QuickOrderResponse> {
  return quickOrderResponseSchema.parse(
    await requestJson('/api/orders', role, { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function transitionOrder(
  role: Role,
  id: string,
  status: OrderStatus,
  reason = '',
): Promise<Order> {
  return orderSchema.parse(
    await requestJson(`/api/orders/${id}/transition`, role, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    }),
  );
}

export async function bulkTransitionOrders(
  role: Role,
  orderIds: string[],
  status: OrderStatus,
): Promise<Order[]> {
  return orderSchema.array().parse(
    await requestJson('/api/orders/bulk-transition', role, {
      method: 'POST',
      body: JSON.stringify({ orderIds, status, reason: 'Bulk workflow action' }),
    }),
  );
}

export async function addOrderNote(role: Role, id: string, text: string): Promise<Order> {
  return orderSchema.parse(
    await requestJson(`/api/orders/${id}/notes`, role, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  );
}

export async function updateOrderTags(role: Role, id: string, tags: string[]): Promise<Order> {
  return orderSchema.parse(
    await requestJson(`/api/orders/${id}/tags`, role, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    }),
  );
}

export async function copyOrderMessage(
  role: Role,
  id: string,
  template: 'CONFIRMATION' | 'REMINDER' | 'STATUS',
): Promise<{ text: string; trackingUrl: string; order: Order }> {
  const value = (await requestJson(`/api/orders/${id}/message-template`, role, {
    method: 'POST',
    body: JSON.stringify({ template }),
  })) as { text: string; trackingUrl: string; order: unknown };
  return {
    text: value.text,
    trackingUrl: value.trackingUrl,
    order: orderSchema.parse(value.order),
  };
}

async function publicJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    ...(init?.body ? { headers: { 'Content-Type': 'application/json' } } : {}),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(value.message ?? 'Request failed.', response.status, value);
  if ((init?.method ?? 'GET').toUpperCase() !== 'GET') {
    window.dispatchEvent(
      new CustomEvent('masaar:data-changed', {
        detail: { path, method: (init?.method ?? 'GET').toUpperCase() },
      }),
    );
  }
  return value;
}

export async function getPublicConfirmation(token: string): Promise<PublicOrder> {
  return publicOrderSchema.parse(
    await publicJson(`/api/public/confirm/${encodeURIComponent(token)}`),
  );
}

export async function submitPublicConfirmation(
  token: string,
  input: unknown,
): Promise<PublicOrder> {
  return publicOrderSchema.parse(
    await publicJson(`/api/public/confirm/${encodeURIComponent(token)}`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function getFulfillmentSnapshot(role: Role): Promise<FulfillmentSnapshot> {
  return fulfillmentSnapshotSchema.parse(await getJson('/api/fulfillment/snapshot', role));
}

export async function assignDelivery(role: Role, input: AssignDelivery) {
  return deliveryCaseSchema.parse(
    await requestJson('/api/fulfillment/assignments', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function createDeliveryResource(role: Role, input: CreateDeliveryResource) {
  return deliveryResourceSchema.parse(
    await requestJson('/api/fulfillment/resources', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateDeliveryResource(
  role: Role,
  id: string,
  input: UpdateDeliveryResource,
) {
  return deliveryResourceSchema.parse(
    await requestJson(`/api/fulfillment/resources/${encodeURIComponent(id)}`, role, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

export async function createDeliveryZone(role: Role, input: CreateDeliveryZone) {
  return deliveryZoneSchema.parse(
    await requestJson('/api/fulfillment/zones', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateDeliveryZone(role: Role, id: string, input: UpdateDeliveryZone) {
  return deliveryZoneSchema.parse(
    await requestJson(`/api/fulfillment/zones/${encodeURIComponent(id)}`, role, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

export async function getDriverStops(role: Role): Promise<DriverStop[]> {
  return driverStopSchema.array().parse(await getJson('/api/driver/stops', role));
}

export async function getDriverWallet(role: Role): Promise<CashPosition[]> {
  return cashPositionSchema.array().parse(await getJson('/api/driver/wallet', role));
}

export async function sendDriverCommand(role: Role, input: DriverCommand) {
  return await requestJson('/api/driver/commands', role, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function recordPaymentEntry(role: Role, input: RecordPayment): Promise<PaymentEntry> {
  return paymentEntrySchema.parse(
    await requestJson('/api/payments', role, { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function createCashReconciliation(
  role: Role,
  input: CreateReconciliation,
): Promise<Reconciliation> {
  return reconciliationSchema.parse(
    await requestJson('/api/reconciliations', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function approveCashReconciliation(
  role: Role,
  id: string,
  reason: string,
): Promise<Reconciliation> {
  return reconciliationSchema.parse(
    await requestJson(`/api/reconciliations/${id}/approve`, role, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function getInventorySnapshot(role: Role): Promise<InventorySnapshot> {
  return inventorySnapshotSchema.parse(await getJson('/api/inventory/snapshot', role));
}

export async function getIntelligenceSnapshot(
  role: Role,
  period: IntelligencePeriod,
): Promise<IntelligenceSnapshot> {
  return intelligenceSnapshotSchema.parse(
    await getJson(`/api/intelligence/snapshot?period=${period}`, role),
  );
}

export async function getPredictiveSnapshot(
  role: Role,
  period: IntelligencePeriod,
): Promise<PredictiveSnapshot> {
  return predictiveSnapshotSchema.parse(
    await getJson(`/api/predictive/snapshot?period=${period}`, role),
  );
}

export async function askMasaar(
  role: Role,
  question: string,
  period: IntelligencePeriod,
): Promise<AssistantResponse> {
  return assistantResponseSchema.parse(
    await requestJson('/api/predictive/assistant', role, {
      method: 'POST',
      body: JSON.stringify({ question, period }),
    }),
  );
}

export async function recordStockReceipt(role: Role, input: RecordStockReceipt) {
  return inventorySnapshotSchema.parse(
    await requestJson('/api/inventory/receipts', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function adjustStock(role: Role, input: AdjustStock) {
  return inventorySnapshotSchema.parse(
    await requestJson('/api/inventory/adjustments', role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function createReturnCase(role: Role, input: CreateReturnCase): Promise<ReturnCase> {
  return returnCaseSchema.parse(
    await requestJson('/api/returns', role, { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function receiveReturnCase(
  role: Role,
  id: string,
  input: ReceiveReturnCase,
): Promise<ReturnCase> {
  return returnCaseSchema.parse(
    await requestJson(`/api/returns/${id}/receive`, role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function resolveReturnCase(
  role: Role,
  id: string,
  input: ResolveReturnCase,
): Promise<ReturnCase> {
  return returnCaseSchema.parse(
    await requestJson(`/api/returns/${id}/resolve`, role, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
