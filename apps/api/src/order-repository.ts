import { orderSchema, type Order } from '@masaar/contracts';

export type StoredOrder = { order: Order; confirmationHash: string };

export interface OrderRepository {
  list(tenantId: string): Promise<Order[]>;
  get(tenantId: string, id: string): Promise<Order | null>;
  save(order: Order, confirmationHash?: string): Promise<void>;
  findByConfirmationHash(hash: string): Promise<Order | null>;
}

const seedTime = '2026-08-22T08:00:00.000Z';
const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' as const });

function seededOrder(
  tenantId: string,
  id: string,
  number: string,
  customerName: string,
  customerPhone: string,
  status: Order['status'],
  sku: string,
  productName: string,
  total: number,
): Order {
  const tote = sku.startsWith('TOT');
  const small = sku.startsWith('LIN-S');
  return orderSchema.parse({
    id,
    tenantId,
    orderNumber: number,
    source: number.endsWith('03') ? 'WHATSAPP' : 'INSTAGRAM',
    status,
    customerName,
    customerPhone,
    deliveryAddress: {
      id: `${id}_address`,
      label: 'Delivery',
      governorate: id.endsWith('7') ? 'Beirut' : 'Mount Lebanon',
      area: id.endsWith('7') ? 'Beirut' : 'Metn',
      locality: id.endsWith('7') ? 'Achrafieh' : 'Antelias',
      street: 'Main Road',
      building: 'Cedar Building',
      floor: '2',
      landmark: 'Near the pharmacy',
      originalWording: 'Main Road, Cedar Building, floor 2, near the pharmacy',
    },
    deliveryNotes: 'Call before arriving',
    items: [
      {
        id: `${id}_line`,
        productId: tote ? 'prd_beirut_tote' : 'prd_linen_shirt',
        variantId: tote ? 'var_tote_navy' : small ? 'var_linen_s_sand' : 'var_linen_m_sand',
        productName,
        sku,
        variantLabel: 'M · Sand',
        quantity: 1,
        unitPrice: usd(total),
        unitCost: usd(Math.round(total * 0.52)),
        lineTotal: usd(total),
      },
    ],
    currency: 'USD',
    totals: {
      itemsSubtotal: usd(total),
      discount: usd(0),
      deliveryFee: usd(400),
      grandTotal: usd(total + 400),
      prepaid: usd(0),
      amountDue: usd(total + 400),
    },
    paymentMethod: 'CASH',
    tags: status === 'READY_FOR_DISPATCH' ? ['priority'] : [],
    notes: [],
    messages: [],
    timeline: [
      {
        id: `${id}_event`,
        actorType: 'USER',
        actorId: 'usr_employee',
        actorName: 'Rami Employee',
        action: 'order.created',
        message: `Order created from ${number.endsWith('03') ? 'WhatsApp' : 'Instagram'}.`,
        toStatus: status,
        occurredAt: seedTime,
      },
    ],
    confirmationExpiresAt: '2026-08-29T08:00:00.000Z',
    confirmedAt: seedTime,
    assignedUserId: ['ASSIGNED_TO_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'].includes(
      status,
    )
      ? 'usr_driver'
      : undefined,
    createdAt: seedTime,
    updatedAt: seedTime,
    createdBy: 'usr_employee',
  });
}

function seed(tenantId: string): StoredOrder[] {
  if (tenantId.startsWith('org_')) return [];
  return [
    seededOrder(
      tenantId,
      'ord_demo_1',
      'MSR-260822-001',
      'Lara Saad',
      '+96170123456',
      'CONFIRMED',
      'LIN-M-SAND',
      'Linen Shirt',
      3500,
    ),
    seededOrder(
      tenantId,
      'ord_demo_2',
      'MSR-260822-002',
      'Omar Karam',
      '+9613111222',
      'PREPARING',
      'TOTE-NAVY',
      'Cedar Tote',
      2200,
    ),
    seededOrder(
      tenantId,
      'ord_demo_3',
      'MSR-260822-003',
      'Mira Fadel',
      '+96176123456',
      'PACKED',
      'LIN-S-SAND',
      'Linen Shirt',
      3500,
    ),
    seededOrder(
      tenantId,
      'ord_demo_4',
      'MSR-260822-004',
      'Tarek Nader',
      '+96181234567',
      'ASSIGNED_TO_DELIVERY',
      'TOTE-NAVY',
      'Cedar Tote',
      2200,
    ),
    seededOrder(
      tenantId,
      'ord_demo_5',
      'MSR-260822-005',
      'Rita Nassar',
      '+96176222111',
      'READY_FOR_DISPATCH',
      'LIN-S-SAND',
      'Linen Shirt',
      3500,
    ),
    seededOrder(
      tenantId,
      'ord_demo_6',
      'MSR-260822-006',
      'Jana Khoury',
      '+96171123456',
      'DELIVERED',
      'LIN-M-SAND',
      'Linen Shirt',
      3500,
    ),
    seededOrder(
      tenantId,
      'ord_demo_7',
      'MSR-260822-007',
      'Nour Haddad',
      '+96103123456',
      'FAILED',
      'LIN-S-SAND',
      'Linen Shirt',
      3500,
    ),
  ].map((order) => ({ order, confirmationHash: `seed-${order.id}` }));
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly tenants = new Map<string, StoredOrder[]>();

  private data(tenantId: string) {
    if (!this.tenants.has(tenantId)) this.tenants.set(tenantId, seed(tenantId));
    return this.tenants.get(tenantId)!;
  }

  async list(tenantId: string) {
    return this.data(tenantId)
      .map(({ order }) => order)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(tenantId: string, id: string) {
    return this.data(tenantId).find(({ order }) => order.id === id)?.order ?? null;
  }

  async save(order: Order, confirmationHash = '') {
    const parsed = orderSchema.parse(order);
    const items = this.data(parsed.tenantId);
    const existing = items.find((item) => item.order.id === parsed.id);
    if (existing) {
      existing.order = parsed;
      if (confirmationHash) existing.confirmationHash = confirmationHash;
    } else {
      items.push({ order: parsed, confirmationHash });
    }
  }

  async findByConfirmationHash(hash: string) {
    for (const items of this.tenants.values()) {
      const found = items.find((item) => item.confirmationHash === hash);
      if (found) return found.order;
    }
    return null;
  }
}
