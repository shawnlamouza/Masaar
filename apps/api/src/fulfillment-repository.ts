import {
  custodyMovementSchema,
  deliveryCaseSchema,
  deliveryResourceSchema,
  deliveryZoneSchema,
  paymentEntrySchema,
  reconciliationSchema,
  type CustodyMovement,
  type DeliveryCase,
  type DeliveryResource,
  type DeliveryZone,
  type PaymentEntry,
  type Reconciliation,
} from '@masaar/contracts';

export type DriverCommandResult = {
  delivery: DeliveryCase;
  payment?: PaymentEntry;
  orderId: string;
};

export interface FulfillmentRepository {
  listResources(tenantId: string): Promise<DeliveryResource[]>;
  saveResource(resource: DeliveryResource): Promise<void>;
  listZones(tenantId: string): Promise<DeliveryZone[]>;
  saveZone(zone: DeliveryZone): Promise<void>;
  listDeliveries(tenantId: string): Promise<DeliveryCase[]>;
  getDelivery(tenantId: string, id: string): Promise<DeliveryCase | null>;
  getDeliveryForOrder(tenantId: string, orderId: string): Promise<DeliveryCase | null>;
  saveDelivery(delivery: DeliveryCase): Promise<void>;
  listPaymentEntries(tenantId: string): Promise<PaymentEntry[]>;
  savePaymentEntry(payment: PaymentEntry): Promise<void>;
  listCustodyMovements(tenantId: string): Promise<CustodyMovement[]>;
  saveCustodyMovement(movement: CustodyMovement): Promise<void>;
  listReconciliations(tenantId: string): Promise<Reconciliation[]>;
  getReconciliation(tenantId: string, id: string): Promise<Reconciliation | null>;
  saveReconciliation(reconciliation: Reconciliation): Promise<void>;
  getCommandResult(tenantId: string, commandId: string): Promise<DriverCommandResult | null>;
  saveCommandResult(
    tenantId: string,
    commandId: string,
    result: DriverCommandResult,
  ): Promise<void>;
}

type TenantFulfillment = {
  resources: DeliveryResource[];
  zones: DeliveryZone[];
  deliveries: DeliveryCase[];
  payments: PaymentEntry[];
  custody: CustodyMovement[];
  reconciliations: Reconciliation[];
  commands: Map<string, DriverCommandResult>;
};

const SEED_TIME = '2026-08-23T07:30:00.000Z';
const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' as const });

function seedTenant(tenantId: string): TenantFulfillment {
  if (tenantId.startsWith('org_')) {
    return {
      resources: [],
      zones: [],
      deliveries: [],
      payments: [],
      custody: [],
      reconciliations: [],
      commands: new Map(),
    };
  }
  const resources = [
    deliveryResourceSchema.parse({
      id: 'usr_driver',
      tenantId,
      name: 'Karim Driver',
      type: 'INTERNAL_DRIVER',
      phone: '+96170111222',
      active: true,
      serviceAreas: ['Beirut', 'Metn'],
      settlementTerms: 'Daily cash handover',
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
    deliveryResourceSchema.parse({
      id: 'drv_elias',
      tenantId,
      name: 'Elias Mansour',
      type: 'FREELANCER',
      phone: '+96176111333',
      active: true,
      serviceAreas: ['Metn', 'Keserwan'],
      settlementTerms: 'Per completed stop',
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
    deliveryResourceSchema.parse({
      id: 'co_beirut_express',
      tenantId,
      name: 'Beirut Express',
      type: 'COMPANY',
      phone: '+9611444555',
      active: true,
      serviceAreas: ['Lebanon'],
      settlementTerms: 'Weekly statement',
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    }),
  ];
  const zones = [
    deliveryZoneSchema.parse({
      id: 'zone_beirut',
      tenantId,
      name: 'Beirut',
      governorates: ['Beirut'],
      areas: ['Achrafieh', 'Hamra', 'Verdun'],
      customerFee: usd(300),
      businessCost: usd(250),
      estimatedDays: 1,
      active: true,
    }),
    deliveryZoneSchema.parse({
      id: 'zone_metn',
      tenantId,
      name: 'Metn',
      governorates: ['Mount Lebanon'],
      areas: ['Antelias', 'Jdeideh', 'Broummana'],
      customerFee: usd(400),
      businessCost: usd(350),
      estimatedDays: 1,
      active: true,
    }),
    deliveryZoneSchema.parse({
      id: 'zone_keserwan',
      tenantId,
      name: 'Keserwan',
      governorates: ['Mount Lebanon'],
      areas: ['Jounieh', 'Ghazir'],
      customerFee: usd(500),
      businessCost: usd(450),
      estimatedDays: 2,
      active: true,
    }),
  ];
  const assignment = (id: string, resourceName: string) => ({
    id: `${id}_assignment`,
    resourceId: 'usr_driver',
    resourceName,
    assignedBy: 'Joe Haddad',
    assignedAt: SEED_TIME,
    reason: 'Morning dispatch',
  });
  const scheduled = (id: string, number = 1) => ({
    id: `${id}_attempt_${number}`,
    number,
    status: 'SCHEDULED' as const,
    scheduledAt: SEED_TIME,
    note: '',
    actorId: 'usr_owner',
  });
  const deliveries = [
    deliveryCaseSchema.parse({
      id: 'del_demo_4',
      tenantId,
      orderId: 'ord_demo_4',
      orderNumber: 'MSR-260822-004',
      status: 'ASSIGNED',
      resourceId: 'usr_driver',
      resourceName: 'Karim Driver',
      resourceType: 'INTERNAL_DRIVER',
      zoneId: 'zone_metn',
      zoneName: 'Metn',
      customerFee: usd(400),
      businessCost: usd(350),
      expectedCollection: usd(2600),
      attempts: [scheduled('del_demo_4')],
      assignmentHistory: [assignment('del_demo_4', 'Karim Driver')],
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      version: 1,
    }),
    deliveryCaseSchema.parse({
      id: 'del_demo_6',
      tenantId,
      orderId: 'ord_demo_6',
      orderNumber: 'MSR-260822-006',
      status: 'COMPLETED',
      resourceId: 'usr_driver',
      resourceName: 'Karim Driver',
      resourceType: 'INTERNAL_DRIVER',
      zoneId: 'zone_metn',
      zoneName: 'Metn',
      customerFee: usd(400),
      businessCost: usd(350),
      expectedCollection: usd(3900),
      attempts: [
        {
          ...scheduled('del_demo_6'),
          status: 'DELIVERED',
          startedAt: '2026-08-23T08:00:00.000Z',
          completedAt: '2026-08-23T08:35:00.000Z',
          actorId: 'usr_driver',
        },
      ],
      assignmentHistory: [assignment('del_demo_6', 'Karim Driver')],
      createdAt: SEED_TIME,
      updatedAt: '2026-08-23T08:35:00.000Z',
      version: 3,
    }),
    deliveryCaseSchema.parse({
      id: 'del_demo_7',
      tenantId,
      orderId: 'ord_demo_7',
      orderNumber: 'MSR-260822-007',
      status: 'FAILED',
      resourceId: 'usr_driver',
      resourceName: 'Karim Driver',
      resourceType: 'INTERNAL_DRIVER',
      zoneId: 'zone_beirut',
      zoneName: 'Beirut',
      customerFee: usd(300),
      businessCost: usd(250),
      expectedCollection: usd(3900),
      attempts: [
        {
          ...scheduled('del_demo_7'),
          status: 'FAILED',
          startedAt: '2026-08-23T08:10:00.000Z',
          completedAt: '2026-08-23T08:28:00.000Z',
          failureReason: 'INCORRECT_ADDRESS',
          note: 'Building could not be identified.',
          actorId: 'usr_driver',
        },
      ],
      assignmentHistory: [assignment('del_demo_7', 'Karim Driver')],
      createdAt: SEED_TIME,
      updatedAt: '2026-08-23T08:28:00.000Z',
      version: 3,
    }),
  ];
  const payment = paymentEntrySchema.parse({
    id: 'pay_demo_cash_6',
    tenantId,
    orderId: 'ord_demo_6',
    orderNumber: 'MSR-260822-006',
    deliveryId: 'del_demo_6',
    type: 'COLLECTION',
    method: 'CASH',
    status: 'POSTED',
    amount: usd(3900),
    reference: 'COD-006',
    holderId: 'usr_driver',
    holderName: 'Karim Driver',
    occurredAt: '2026-08-23T08:35:00.000Z',
    createdAt: '2026-08-23T08:35:00.000Z',
    createdBy: 'usr_driver',
  });
  const custody = custodyMovementSchema.parse({
    id: 'cash_demo_6',
    tenantId,
    paymentId: payment.id,
    type: 'DRIVER_COLLECTION',
    amount: usd(3900),
    toHolderId: 'usr_driver',
    toHolderName: 'Karim Driver',
    occurredAt: payment.occurredAt,
    actorId: 'usr_driver',
    note: 'Cash collected on delivery.',
  });
  return {
    resources,
    zones,
    deliveries,
    payments: [payment],
    custody: [custody],
    reconciliations: [],
    commands: new Map(),
  };
}

export class InMemoryFulfillmentRepository implements FulfillmentRepository {
  private readonly tenants = new Map<string, TenantFulfillment>();
  private data(tenantId: string) {
    if (!this.tenants.has(tenantId)) this.tenants.set(tenantId, seedTenant(tenantId));
    return this.tenants.get(tenantId)!;
  }
  async listResources(tenantId: string) {
    return this.data(tenantId).resources;
  }
  async saveResource(resource: DeliveryResource) {
    const parsed = deliveryResourceSchema.parse(resource);
    const items = this.data(parsed.tenantId).resources;
    const index = items.findIndex((item) => item.id === parsed.id);
    if (index >= 0) items[index] = parsed;
    else items.push(parsed);
  }
  async listZones(tenantId: string) {
    return this.data(tenantId).zones;
  }
  async saveZone(zone: DeliveryZone) {
    const parsed = deliveryZoneSchema.parse(zone);
    const items = this.data(parsed.tenantId).zones;
    const index = items.findIndex((item) => item.id === parsed.id);
    if (index >= 0) items[index] = parsed;
    else items.push(parsed);
  }
  async listDeliveries(tenantId: string) {
    return this.data(tenantId)
      .deliveries.slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getDelivery(tenantId: string, id: string) {
    return this.data(tenantId).deliveries.find((item) => item.id === id) ?? null;
  }
  async getDeliveryForOrder(tenantId: string, orderId: string) {
    return (
      this.data(tenantId).deliveries.find(
        (item) => item.orderId === orderId && item.status !== 'CANCELLED',
      ) ?? null
    );
  }
  async saveDelivery(delivery: DeliveryCase) {
    const parsed = deliveryCaseSchema.parse(delivery);
    const items = this.data(parsed.tenantId).deliveries;
    const index = items.findIndex((item) => item.id === parsed.id);
    if (index >= 0) items[index] = parsed;
    else items.push(parsed);
  }
  async listPaymentEntries(tenantId: string) {
    return this.data(tenantId)
      .payments.slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
  async savePaymentEntry(payment: PaymentEntry) {
    const parsed = paymentEntrySchema.parse(payment);
    const items = this.data(parsed.tenantId).payments;
    if (!items.some((item) => item.id === parsed.id)) items.push(parsed);
  }
  async listCustodyMovements(tenantId: string) {
    return this.data(tenantId)
      .custody.slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
  async saveCustodyMovement(movement: CustodyMovement) {
    const parsed = custodyMovementSchema.parse(movement);
    const items = this.data(parsed.tenantId).custody;
    if (!items.some((item) => item.id === parsed.id)) items.push(parsed);
  }
  async listReconciliations(tenantId: string) {
    return this.data(tenantId)
      .reconciliations.slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getReconciliation(tenantId: string, id: string) {
    return this.data(tenantId).reconciliations.find((item) => item.id === id) ?? null;
  }
  async saveReconciliation(reconciliation: Reconciliation) {
    const parsed = reconciliationSchema.parse(reconciliation);
    const items = this.data(parsed.tenantId).reconciliations;
    const index = items.findIndex((item) => item.id === parsed.id);
    if (index >= 0) items[index] = parsed;
    else items.push(parsed);
  }
  async getCommandResult(tenantId: string, commandId: string) {
    return this.data(tenantId).commands.get(commandId) ?? null;
  }
  async saveCommandResult(tenantId: string, commandId: string, result: DriverCommandResult) {
    this.data(tenantId).commands.set(commandId, result);
  }
}
