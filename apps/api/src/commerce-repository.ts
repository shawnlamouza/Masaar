import {
  customerSchema,
  fxSnapshotSchema,
  priceReviewSchema,
  productSchema,
  supplierSchema,
  type Customer,
  type FxSnapshot,
  type PriceReview,
  type Product,
  type Supplier,
} from '@masaar/contracts';

export interface CommerceRepository {
  listProducts(tenantId: string): Promise<Product[]>;
  getProduct(tenantId: string, id: string): Promise<Product | null>;
  saveProduct(product: Product): Promise<void>;
  listSuppliers(tenantId: string): Promise<Supplier[]>;
  getSupplier(tenantId: string, id: string): Promise<Supplier | null>;
  saveSupplier(supplier: Supplier): Promise<void>;
  listCustomers(tenantId: string): Promise<Customer[]>;
  getCustomer(tenantId: string, id: string): Promise<Customer | null>;
  saveCustomer(customer: Customer): Promise<void>;
  listFxSnapshots(tenantId: string): Promise<FxSnapshot[]>;
  getFxSnapshot(tenantId: string, id: string): Promise<FxSnapshot | null>;
  saveFxSnapshot(snapshot: FxSnapshot): Promise<void>;
  listPriceReviews(tenantId: string): Promise<PriceReview[]>;
  getPriceReview(tenantId: string, id: string): Promise<PriceReview | null>;
  savePriceReview(review: PriceReview): Promise<void>;
}

type TenantData = {
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  fxSnapshots: FxSnapshot[];
  priceReviews: PriceReview[];
};

const SEED_TIME = '2026-08-22T08:00:00.000Z';

function seedTenant(tenantId: string): TenantData {
  if (tenantId.startsWith('org_')) {
    return { products: [], suppliers: [], customers: [], fxSnapshots: [], priceReviews: [] };
  }
  const fx = fxSnapshotSchema.parse({
    id: 'fx_demo_89500',
    tenantId,
    baseCurrency: 'USD',
    quoteCurrency: 'LBP',
    lbpPerUsd: 89500,
    effectiveAt: SEED_TIME,
    source: 'OWNER_ENTERED',
    note: 'Owner-entered operating reference; not an automatic market feed.',
    recordedBy: 'usr_owner',
    createdAt: SEED_TIME,
  });
  const suppliers = [
    supplierSchema.parse({
      id: 'sup_cedar_textiles',
      tenantId,
      name: 'Cedar Textiles',
      contactName: 'Hadi Nassar',
      phone: '+96170111444',
      leadTimeDays: 6,
      minimumOrderQuantity: 12,
      lastPurchaseCost: { amountMinor: 1800, currency: 'USD' },
      active: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
    supplierSchema.parse({
      id: 'sup_beirut_print',
      tenantId,
      name: 'Beirut Print House',
      contactName: 'Rita Haddad',
      phone: '+9613122255',
      leadTimeDays: 4,
      minimumOrderQuantity: 20,
      lastPurchaseCost: { amountMinor: 1100, currency: 'USD' },
      active: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
  ];
  const snapshot = (id: string, amountMinor: number, currency: 'USD' | 'LBP', reason: string) => ({
    id,
    value: { amountMinor, currency },
    effectiveAt: SEED_TIME,
    reason,
    recordedBy: 'usr_owner',
    fxSnapshotId: fx.id,
  });
  const products = [
    productSchema.parse({
      id: 'prd_linen_shirt',
      tenantId,
      name: 'Linen Shirt',
      category: 'Apparel',
      active: true,
      trackStock: true,
      variants: [
        {
          id: 'var_linen_s_sand',
          sku: 'LIN-S-SAND',
          size: 'S',
          color: 'Sand',
          available: true,
          stockOnHand: 8,
          currentSellingPrice: { amountMinor: 3500, currency: 'USD' },
          currentUnitCost: { amountMinor: 1800, currency: 'USD' },
          supplierId: 'sup_cedar_textiles',
          priceHistory: [snapshot('price_linen_s_1', 3500, 'USD', 'Opening selling price')],
          costHistory: [snapshot('cost_linen_s_1', 1800, 'USD', 'Last confirmed supplier cost')],
        },
        {
          id: 'var_linen_m_sand',
          sku: 'LIN-M-SAND',
          size: 'M',
          color: 'Sand',
          available: true,
          stockOnHand: 5,
          currentSellingPrice: { amountMinor: 3500, currency: 'USD' },
          currentUnitCost: { amountMinor: 1800, currency: 'USD' },
          supplierId: 'sup_cedar_textiles',
          priceHistory: [snapshot('price_linen_m_1', 3500, 'USD', 'Opening selling price')],
          costHistory: [snapshot('cost_linen_m_1', 1800, 'USD', 'Last confirmed supplier cost')],
        },
      ],
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
    productSchema.parse({
      id: 'prd_beirut_tote',
      tenantId,
      name: 'Beirut Line Tote',
      category: 'Accessories',
      active: true,
      trackStock: true,
      variants: [
        {
          id: 'var_tote_navy',
          sku: 'TOTE-NAVY',
          color: 'Navy',
          available: true,
          stockOnHand: 18,
          currentSellingPrice: { amountMinor: 1800000, currency: 'LBP' },
          currentUnitCost: { amountMinor: 1100, currency: 'USD' },
          supplierId: 'sup_beirut_print',
          priceHistory: [
            snapshot('price_tote_1', 1800000, 'LBP', 'LBP selling price approved by owner'),
          ],
          costHistory: [snapshot('cost_tote_1', 1100, 'USD', 'Last confirmed supplier cost')],
        },
      ],
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
  ];
  const customers = [
    customerSchema.parse({
      id: 'cus_maya_khoury',
      tenantId,
      name: 'Jana Khoury',
      phoneOriginal: '70 123 456',
      phoneNormalized: '+96170123456',
      preferredPaymentMethod: 'WHISH',
      addresses: [
        {
          id: 'addr_maya_home',
          label: 'Home',
          governorate: 'Beirut',
          area: 'Achrafieh',
          locality: 'Sassine',
          street: 'Independence Street',
          building: 'Cedar Building',
          floor: '4',
          landmark: 'Behind ABC Mall',
          mapUrl: 'https://maps.google.com/?q=33.8886,35.5195',
          originalWording: 'Achrafieh, behind ABC, Cedar bldg 4th floor',
        },
      ],
      orderStats: {
        completedOrders: 6,
        cancelledOrders: 0,
        failedDeliveries: 1,
        lifetimeSpendUsdMinor: 28400,
        lastOrderAt: '2026-08-18T14:30:00.000Z',
      },
      tags: ['repeat customer', 'WhatsApp'],
      notes: 'Usually available after 5 PM.',
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
    customerSchema.parse({
      id: 'cus_omar_saab',
      tenantId,
      name: 'Omar Saab',
      phoneOriginal: '03 445 566',
      phoneNormalized: '+9613445566',
      preferredPaymentMethod: 'CASH',
      addresses: [
        {
          id: 'addr_omar_work',
          label: 'Work',
          governorate: 'Mount Lebanon',
          area: 'Metn',
          locality: 'Sin El Fil',
          street: 'Main road',
          building: 'Saab Center',
          floor: '2',
          landmark: 'Opposite the municipality',
          originalWording: 'Sin el fil main road Saab center floor 2',
        },
      ],
      orderStats: {
        completedOrders: 2,
        cancelledOrders: 1,
        failedDeliveries: 0,
        lifetimeSpendUsdMinor: 7900,
      },
      tags: ['Instagram'],
      notes: '',
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
  ];
  return { products, suppliers, customers, fxSnapshots: [fx], priceReviews: [] };
}

function replaceById<T extends { id: string }>(items: T[], value: T) {
  const index = items.findIndex((item) => item.id === value.id);
  if (index === -1) items.push(value);
  else items[index] = value;
}

export class InMemoryCommerceRepository implements CommerceRepository {
  private readonly tenants = new Map<string, TenantData>();

  private data(tenantId: string) {
    const current = this.tenants.get(tenantId);
    if (current) return current;
    const seeded = seedTenant(tenantId);
    this.tenants.set(tenantId, seeded);
    return seeded;
  }

  async listProducts(tenantId: string) {
    return structuredClone(this.data(tenantId).products);
  }
  async getProduct(tenantId: string, id: string) {
    return structuredClone(this.data(tenantId).products.find((item) => item.id === id) ?? null);
  }
  async saveProduct(product: Product) {
    replaceById(
      this.data(product.tenantId).products,
      productSchema.parse(structuredClone(product)),
    );
  }
  async listSuppliers(tenantId: string) {
    return structuredClone(this.data(tenantId).suppliers);
  }
  async getSupplier(tenantId: string, id: string) {
    return structuredClone(this.data(tenantId).suppliers.find((item) => item.id === id) ?? null);
  }
  async saveSupplier(supplier: Supplier) {
    replaceById(
      this.data(supplier.tenantId).suppliers,
      supplierSchema.parse(structuredClone(supplier)),
    );
  }
  async listCustomers(tenantId: string) {
    return structuredClone(this.data(tenantId).customers);
  }
  async getCustomer(tenantId: string, id: string) {
    return structuredClone(this.data(tenantId).customers.find((item) => item.id === id) ?? null);
  }
  async saveCustomer(customer: Customer) {
    replaceById(
      this.data(customer.tenantId).customers,
      customerSchema.parse(structuredClone(customer)),
    );
  }
  async listFxSnapshots(tenantId: string) {
    return structuredClone(this.data(tenantId).fxSnapshots).sort((a, b) =>
      b.effectiveAt.localeCompare(a.effectiveAt),
    );
  }
  async getFxSnapshot(tenantId: string, id: string) {
    return structuredClone(this.data(tenantId).fxSnapshots.find((item) => item.id === id) ?? null);
  }
  async saveFxSnapshot(snapshot: FxSnapshot) {
    replaceById(
      this.data(snapshot.tenantId).fxSnapshots,
      fxSnapshotSchema.parse(structuredClone(snapshot)),
    );
  }
  async listPriceReviews(tenantId: string) {
    return structuredClone(this.data(tenantId).priceReviews).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  async getPriceReview(tenantId: string, id: string) {
    return structuredClone(this.data(tenantId).priceReviews.find((item) => item.id === id) ?? null);
  }
  async savePriceReview(review: PriceReview) {
    replaceById(
      this.data(review.tenantId).priceReviews,
      priceReviewSchema.parse(structuredClone(review)),
    );
  }
}

export function normalizeLebanesePhone(input: string) {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00961')) digits = digits.slice(5);
  else if (digits.startsWith('961')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^\d{7,8}$/.test(digits)) throw new Error('Enter a valid Lebanese phone number.');
  return `+961${digits}`;
}
