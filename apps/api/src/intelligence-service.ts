import {
  intelligenceSnapshotSchema,
  type Customer,
  type DeliveryCase,
  type IntelligencePeriod,
  type IntelligenceSnapshot,
  type InventoryStockItem,
  type Order,
  type OrderSource,
  type PaymentEntry,
  type Reconciliation,
  type ReturnCase,
  type CashPosition,
  type FxSnapshot,
  type Money,
} from '@masaar/contracts';

type Fact = {
  id: string;
  occurredAt: string;
  source: OrderSource;
  productId: string;
  productName: string;
  area: string;
  governorate: string;
  revenueMinor: number;
  costMinor: number;
  collectedMinor: number;
  delivered: boolean;
  attempted: boolean;
  failed: boolean;
  firstAttempt: boolean;
  failureReason?: string;
  customerKey: string;
};

export type IntelligenceInputs = {
  tenantId: string;
  period: IntelligencePeriod;
  orders: Order[];
  deliveries: DeliveryCase[];
  payments: PaymentEntry[];
  cashPositions: CashPosition[];
  reconciliations: Reconciliation[];
  inventoryItems: InventoryStockItem[];
  returns: ReturnCase[];
  customers: Customer[];
  latestFx: FxSnapshot | null;
};

const PERIOD_DAYS: Record<IntelligencePeriod, number> = { '7D': 7, '30D': 30, '90D': 90 };
const SOURCE_ROTATION: OrderSource[] = [
  'INSTAGRAM',
  'WHATSAPP',
  'INSTAGRAM',
  'TIKTOK',
  'WEBSITE',
  'WHATSAPP',
  'FACEBOOK',
];
const PRODUCTS = [
  { id: 'prd_linen_shirt', name: 'Linen Shirt', price: 3900, cost: 1820 },
  { id: 'prd_beirut_tote', name: 'Beirut Line Tote', price: 2600, cost: 1150 },
  { id: 'prd_linen_shirt', name: 'Linen Shirt', price: 3500, cost: 1820 },
];
const AREAS = [
  { area: 'Achrafieh', governorate: 'Beirut' },
  { area: 'Antelias', governorate: 'Mount Lebanon' },
  { area: 'Hamra', governorate: 'Beirut' },
  { area: 'Jounieh', governorate: 'Mount Lebanon' },
  { area: 'Tripoli', governorate: 'North Lebanon' },
  { area: 'Zahle', governorate: 'Bekaa' },
];

function demoFacts(): Fact[] {
  const start = Date.parse('2026-05-26T10:00:00.000Z');
  return Array.from({ length: 76 }, (_, index) => {
    const date = new Date(start + index * 29 * 60 * 60 * 1000);
    const product = PRODUCTS[index % PRODUCTS.length]!;
    const area = AREAS[(index * 5) % AREAS.length]!;
    const failed = index % 11 === 0 || (area.area === 'Tripoli' && index % 9 === 0);
    const delivered = !failed;
    const price = product.price + (index % 5 === 0 ? 300 : 0);
    return {
      id: `history_${index}`,
      occurredAt: date.toISOString(),
      source: SOURCE_ROTATION[index % SOURCE_ROTATION.length]!,
      productId: product.id,
      productName: product.name,
      area: area.area,
      governorate: area.governorate,
      revenueMinor: delivered ? price : 0,
      costMinor: delivered ? product.cost : 0,
      collectedMinor: delivered && index % 13 !== 0 ? price : 0,
      delivered,
      attempted: true,
      failed,
      firstAttempt: delivered && index % 8 !== 0,
      ...(failed
        ? { failureReason: index % 2 === 0 ? 'INCORRECT_ADDRESS' : 'CUSTOMER_UNAVAILABLE' }
        : {}),
      customerKey: `demo_customer_${index % 16}`,
    };
  });
}

function toUsdMinor(value: Money, latestFx: FxSnapshot | null) {
  if (value.currency === 'USD') return value.amountMinor;
  return latestFx ? Math.round((value.amountMinor / latestFx.lbpPerUsd) * 100) : 0;
}

function operationalFacts(input: IntelligenceInputs): Fact[] {
  const deliveries = new Map(input.deliveries.map((item) => [item.orderId, item]));
  const paymentsByOrder = new Map<string, number>();
  for (const payment of input.payments) {
    if (payment.status !== 'POSTED') continue;
    const direction = payment.type === 'REFUND' ? -1 : 1;
    paymentsByOrder.set(
      payment.orderId,
      (paymentsByOrder.get(payment.orderId) ?? 0) +
        direction * toUsdMinor(payment.amount, input.latestFx),
    );
  }
  return input.orders.map((order) => {
    const delivery = deliveries.get(order.id);
    const recognized = ['DELIVERED', 'RETURNED', 'REFUNDED'].includes(order.status);
    const failed = order.status === 'FAILED' || delivery?.status === 'FAILED';
    const lastAttempt = delivery?.attempts.at(-1);
    const revenue = recognized ? toUsdMinor(order.totals.grandTotal, input.latestFx) : 0;
    const cost = recognized
      ? order.items.reduce(
          (sum, item) => sum + toUsdMinor(item.unitCost, input.latestFx) * item.quantity,
          0,
        )
      : 0;
    return {
      id: order.id,
      occurredAt: order.updatedAt,
      source: order.source,
      productId: order.items[0]?.productId ?? 'unknown',
      productName: order.items[0]?.productName ?? 'Unknown product',
      area: order.deliveryAddress?.locality ?? order.deliveryAddress?.area ?? 'Address pending',
      governorate: order.deliveryAddress?.governorate ?? 'Address pending',
      revenueMinor: revenue,
      costMinor: cost,
      collectedMinor: Math.max(0, paymentsByOrder.get(order.id) ?? 0),
      delivered: recognized,
      attempted: Boolean(delivery?.attempts.length),
      failed,
      firstAttempt: delivery?.attempts[0]?.status === 'DELIVERED',
      ...(lastAttempt?.failureReason ? { failureReason: lastAttempt.failureReason } : {}),
      customerKey: order.customerId ?? order.customerPhone,
    };
  });
}

const pct = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;
const change = (current: number, previous: number) =>
  previous === 0 ? null : round1(((current - previous) / Math.abs(previous)) * 100);

function inWindow(fact: Fact, from: number, until: number) {
  const time = Date.parse(fact.occurredAt);
  return time >= from && time < until;
}

export function buildIntelligenceSnapshot(input: IntelligenceInputs): IntelligenceSnapshot {
  const demo = !input.tenantId.startsWith('org_');
  const allFacts = [...(demo ? demoFacts() : []), ...operationalFacts(input)];
  const days = PERIOD_DAYS[input.period];
  const now = demo ? Date.parse('2026-08-24T12:00:00.000Z') : Date.now();
  const from = now - days * 86_400_000;
  const previousFrom = from - days * 86_400_000;
  const current = allFacts.filter((fact) => inWindow(fact, from, now + 1));
  const previous = allFacts.filter((fact) => inWindow(fact, previousFrom, from));
  const recognized = current.filter((fact) => fact.delivered);
  const previousRecognized = previous.filter((fact) => fact.delivered);
  const revenue = recognized.reduce((sum, fact) => sum + fact.revenueMinor, 0);
  const previousRevenue = previousRecognized.reduce((sum, fact) => sum + fact.revenueMinor, 0);
  const grossProfit = recognized.reduce((sum, fact) => sum + fact.revenueMinor - fact.costMinor, 0);
  const previousGross = previousRecognized.reduce(
    (sum, fact) => sum + fact.revenueMinor - fact.costMinor,
    0,
  );
  const collected = current.reduce((sum, fact) => sum + fact.collectedMinor, 0);
  const previousCollected = previous.reduce((sum, fact) => sum + fact.collectedMinor, 0);
  const attempted = current.filter((fact) => fact.attempted);
  const deliveredAttempts = attempted.filter((fact) => fact.delivered);
  const priorAttempted = previous.filter((fact) => fact.attempted);
  const priorDelivered = priorAttempted.filter((fact) => fact.delivered);
  const uniqueCustomers = new Set(recognized.map((fact) => fact.customerKey));
  const customerCounts = new Map<string, number>();
  for (const fact of recognized)
    customerCounts.set(fact.customerKey, (customerCounts.get(fact.customerKey) ?? 0) + 1);
  const repeatCustomers = [...customerCounts.values()].filter((count) => count > 1).length;

  const bucketDays = input.period === '90D' ? 7 : input.period === '30D' ? 3 : 1;
  const trend = [];
  for (let cursor = from; cursor < now; cursor += bucketDays * 86_400_000) {
    const end = Math.min(now + 1, cursor + bucketDays * 86_400_000);
    const bucket = current.filter((fact) => inWindow(fact, cursor, end));
    trend.push({
      date: new Date(cursor).toISOString().slice(0, 10),
      revenueMinor: bucket.reduce((sum, fact) => sum + fact.revenueMinor, 0),
      grossProfitMinor: bucket.reduce((sum, fact) => sum + fact.revenueMinor - fact.costMinor, 0),
      collectedMinor: bucket.reduce((sum, fact) => sum + fact.collectedMinor, 0),
      orders: bucket.length,
      delivered: bucket.filter((fact) => fact.delivered).length,
    });
  }

  const channelMap = new Map<OrderSource, Fact[]>();
  for (const fact of current)
    channelMap.set(fact.source, [...(channelMap.get(fact.source) ?? []), fact]);
  const channels = [...channelMap.entries()]
    .map(([channel, facts]) => {
      const channelRevenue = facts.reduce((sum, fact) => sum + fact.revenueMinor, 0);
      const channelGross = facts.reduce((sum, fact) => sum + fact.revenueMinor - fact.costMinor, 0);
      return {
        channel,
        revenueMinor: channelRevenue,
        grossProfitMinor: channelGross,
        orders: facts.length,
        averageOrderMinor: facts.length ? Math.round(channelRevenue / facts.length) : 0,
        sharePercent: round1(pct(channelRevenue, revenue)),
      };
    })
    .sort((a, b) => b.revenueMinor - a.revenueMinor);

  const productMap = new Map<string, Fact[]>();
  for (const fact of recognized)
    productMap.set(fact.productId, [...(productMap.get(fact.productId) ?? []), fact]);
  const inventoryByProduct = new Map<string, InventoryStockItem[]>();
  for (const item of input.inventoryItems)
    inventoryByProduct.set(item.productId, [
      ...(inventoryByProduct.get(item.productId) ?? []),
      item,
    ]);
  const products = [...productMap.entries()]
    .map(([productId, facts]) => {
      const productRevenue = facts.reduce((sum, fact) => sum + fact.revenueMinor, 0);
      const productGross = facts.reduce((sum, fact) => sum + fact.revenueMinor - fact.costMinor, 0);
      const stock = inventoryByProduct.get(productId) ?? [];
      const available = stock.reduce((sum, item) => sum + item.available, 0);
      const covers = stock
        .map((item) => item.stockCoverDays)
        .filter((value): value is number => value !== null);
      const cover = covers.length
        ? round1(covers.reduce((sum, value) => sum + value, 0) / covers.length)
        : null;
      const margin = round1(pct(productGross, productRevenue));
      return {
        productId,
        productName: facts[0]!.productName,
        units: facts.length,
        revenueMinor: productRevenue,
        grossProfitMinor: productGross,
        marginPercent: margin,
        availableUnits: available,
        stockCoverDays: cover,
        signal: (available <= 3
          ? 'RESTOCK'
          : margin < 35
            ? 'WATCH'
            : cover !== null && cover > 120
              ? 'SLOW'
              : 'WINNER') as 'RESTOCK' | 'WATCH' | 'SLOW' | 'WINNER',
      };
    })
    .sort((a, b) => b.grossProfitMinor - a.grossProfitMinor);

  const areaMap = new Map<string, Fact[]>();
  for (const fact of current)
    areaMap.set(`${fact.governorate}|${fact.area}`, [
      ...(areaMap.get(`${fact.governorate}|${fact.area}`) ?? []),
      fact,
    ]);
  const areas = [...areaMap.entries()]
    .map(([key, facts]) => {
      const [governorate, area] = key.split('|') as [string, string];
      const areaRevenue = facts.reduce((sum, fact) => sum + fact.revenueMinor, 0);
      const areaAttempts = facts.filter((fact) => fact.attempted);
      return {
        area,
        governorate,
        orders: facts.length,
        revenueMinor: areaRevenue,
        deliverySuccessPercent: round1(
          pct(areaAttempts.filter((fact) => fact.delivered).length, areaAttempts.length),
        ),
        failedDeliveries: areaAttempts.filter((fact) => fact.failed).length,
        averageOrderMinor: facts.length ? Math.round(areaRevenue / facts.length) : 0,
      };
    })
    .sort((a, b) => b.revenueMinor - a.revenueMinor);

  const failed = attempted.filter((fact) => fact.failed);
  const reasonCounts = new Map<string, number>();
  for (const fact of failed) {
    const reason = fact.failureReason ?? 'UNSPECIFIED';
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const failureMix = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count, percent: round1(pct(count, failed.length)) }))
    .sort((a, b) => b.count - a.count);

  const inventoryValue = input.inventoryItems.reduce(
    (sum, item) => sum + Math.max(0, item.onHand) * toUsdMinor(item.unitCost, input.latestFx),
    0,
  );
  const restock = input.inventoryItems.reduce(
    (sum, item) => sum + toUsdMinor(item.suggestedRestockCost, input.latestFx),
    0,
  );
  const cashHeld = input.cashPositions.reduce(
    (sum, position) =>
      position.holderId !== 'business_cash'
        ? sum + toUsdMinor(position.amount, input.latestFx)
        : sum,
    0,
  );
  const refunds = input.returns.reduce(
    (sum, item) => sum + (item.refundAmount ? toUsdMinor(item.refundAmount, input.latestFx) : 0),
    0,
  );
  const outstanding = Math.max(0, revenue - collected);
  const success = round1(pct(deliveredAttempts.length, attempted.length));
  const priorSuccess = round1(pct(priorDelivered.length, priorAttempted.length));
  const firstAttempt = round1(
    pct(attempted.filter((fact) => fact.firstAttempt).length, attempted.length),
  );
  const costComplete = recognized.length
    ? round1(pct(recognized.filter((fact) => fact.costMinor > 0).length, recognized.length))
    : 0;
  const knownDeliveryCost = input.deliveries.reduce(
    (sum, item) => sum + toUsdMinor(item.businessCost, input.latestFx),
    0,
  );
  const lowStock = input.inventoryItems.filter((item) => ['LOW', 'OUT'].includes(item.state));
  const largestFailure = failureMix[0];
  const bestChannel = channels[0];
  const insights: IntelligenceSnapshot['insights'] = [
    ...(cashHeld > 0
      ? [
          {
            id: 'cash-custody',
            severity: 'CRITICAL' as const,
            title: 'Collected cash is still outside the business',
            explanation:
              'Posted collections remain assigned to a driver or employee until an approved handover closes custody.',
            impact: `$${(cashHeld / 100).toFixed(2)} is currently held outside the register.`,
            recommendation: 'Review the holder ledger and complete the next cash handover.',
            confidence: 'HIGH' as const,
            target: 'Payments' as const,
          },
        ]
      : []),
    ...(lowStock.length
      ? [
          {
            id: 'stock-pressure',
            severity: 'WARNING' as const,
            title: 'Demand is approaching available stock',
            explanation: `${lowStock.length} tracked variant${lowStock.length === 1 ? ' is' : 's are'} low or unavailable after reservations.`,
            impact: `$${(restock / 100).toFixed(2)} is the explainable restock estimate.`,
            recommendation:
              'Confirm supplier lead time and receive only the quantity the business approves.',
            confidence: 'HIGH' as const,
            target: 'Stock Control' as const,
          },
        ]
      : []),
    ...(largestFailure
      ? [
          {
            id: 'delivery-failure-mix',
            severity: 'WARNING' as const,
            title: `${largestFailure.reason
              .toLowerCase()
              .replaceAll('_', ' ')
              .replace(/^./, (letter) => letter.toUpperCase())} drives delivery failure`,
            explanation: `${largestFailure.percent}% of failed attempts in this period share this recorded reason.`,
            impact: `${largestFailure.count} avoidable customer experience failure${largestFailure.count === 1 ? '' : 's'}.`,
            recommendation: 'Tighten confirmation details for the affected areas before dispatch.',
            confidence: failed.length >= 3 ? ('HIGH' as const) : ('MEDIUM' as const),
            target: 'Delivery' as const,
          },
        ]
      : []),
    ...(bestChannel
      ? [
          {
            id: 'channel-focus',
            severity: 'OPPORTUNITY' as const,
            title: `${bestChannel.channel.replaceAll('_', ' ')} is the strongest revenue source`,
            explanation: `It contributes ${bestChannel.sharePercent}% of recognized revenue in the selected period.`,
            impact: `$${(bestChannel.grossProfitMinor / 100).toFixed(2)} gross profit is attributed to this source.`,
            recommendation:
              'Protect the winning channel while comparing margin—not just order count—before spending more.',
            confidence: bestChannel.orders >= 5 ? ('HIGH' as const) : ('MEDIUM' as const),
            target: 'Orders' as const,
          },
        ]
      : []),
    {
      id: 'repeat-engine',
      severity: repeatCustomers ? 'OPPORTUNITY' : 'INFO',
      title: repeatCustomers
        ? 'Repeat buyers are becoming a growth engine'
        : 'Repeat behavior needs more history',
      explanation: `${round1(pct(repeatCustomers, uniqueCustomers.size))}% of active customers ordered more than once in this period.`,
      impact: repeatCustomers
        ? `${repeatCustomers} repeat customer relationships can be nurtured.`
        : 'No reliable repeat segment yet.',
      recommendation: repeatCustomers
        ? 'Open Customers and prepare a relevant follow-up segment.'
        : 'Keep customer identities clean as orders accumulate.',
      confidence: uniqueCustomers.size >= 10 ? 'HIGH' : 'LOW',
      target: 'Customers',
    },
  ];

  const metric = (
    id: string,
    label: string,
    value: number,
    previousValue: number,
    unit: 'MONEY_MINOR' | 'PERCENT' | 'COUNT',
    direction: 'UP_IS_GOOD' | 'DOWN_IS_GOOD' | 'NEUTRAL',
    definition: string,
    sourceCount = current.length,
    completeness = 100,
  ) => ({
    id,
    label,
    value,
    previousValue,
    changePercent: change(value, previousValue),
    unit,
    ...(unit === 'MONEY_MINOR' ? { currency: 'USD' as const } : {}),
    direction,
    definition,
    sourceCount,
    completeness,
  });

  return intelligenceSnapshotSchema.parse({
    generatedAt: new Date().toISOString(),
    period: input.period,
    periodLabel: `Last ${days} days`,
    dataMode: demo ? 'DEMO_WITH_HISTORY' : 'LIVE',
    currency: 'USD',
    metrics: [
      metric(
        'revenue',
        'Recognized revenue',
        revenue,
        previousRevenue,
        'MONEY_MINOR',
        'UP_IS_GOOD',
        'Delivered order value less recognized refunds; delivery and payment remain separate.',
        recognized.length,
      ),
      metric(
        'gross-margin',
        'Gross margin',
        round1(pct(grossProfit, revenue)),
        round1(pct(previousGross, previousRevenue)),
        'PERCENT',
        'UP_IS_GOOD',
        'Recognized revenue minus snapshotted product cost. Delivery and marketing costs are not deducted.',
        recognized.length,
        costComplete,
      ),
      metric(
        'average-order',
        'Average order value',
        recognized.length ? Math.round(revenue / recognized.length) : 0,
        previousRecognized.length ? Math.round(previousRevenue / previousRecognized.length) : 0,
        'MONEY_MINOR',
        'UP_IS_GOOD',
        'Recognized revenue divided by recognized orders.',
        recognized.length,
      ),
      metric(
        'delivery-success',
        'Delivery success',
        success,
        priorSuccess,
        'PERCENT',
        'UP_IS_GOOD',
        'Completed final deliveries divided by attempted delivery cases.',
        attempted.length,
      ),
      metric(
        'cash-conversion',
        'Payment completion',
        round1(pct(collected, revenue)),
        round1(pct(previousCollected, previousRevenue)),
        'PERCENT',
        'UP_IS_GOOD',
        'Posted collections divided by recognized revenue; delivery never implies payment.',
        recognized.length,
      ),
      metric(
        'repeat-rate',
        'Repeat customer rate',
        round1(pct(repeatCustomers, uniqueCustomers.size)),
        0,
        'PERCENT',
        'UP_IS_GOOD',
        'Active customers with more than one recognized order in the selected period.',
        uniqueCustomers.size,
      ),
    ],
    trend,
    channels,
    products,
    areas,
    failureMix,
    cash: {
      recognizedRevenueMinor: revenue,
      collectedMinor: collected,
      outstandingMinor: outstanding,
      cashHeldMinor: cashHeld,
      inventoryValueMinor: inventoryValue,
      suggestedRestockMinor: restock,
      refundsMinor: refunds,
    },
    customers: {
      activeCustomers: uniqueCustomers.size,
      repeatCustomers,
      repeatRatePercent: round1(pct(repeatCustomers, uniqueCustomers.size)),
      estimatedLifetimeValueMinor: uniqueCustomers.size
        ? Math.round(revenue / uniqueCustomers.size)
        : 0,
    },
    delivery: {
      attempted: attempted.length,
      delivered: deliveredAttempts.length,
      successPercent: success,
      firstAttemptSuccessPercent: firstAttempt,
      knownCostMinor: knownDeliveryCost,
    },
    insights: insights.slice(0, 5),
    methodology: [
      input.latestFx
        ? `This USD view converts LBP records with the owner-approved reference of ${input.latestFx.lbpPerUsd.toLocaleString()} LBP/USD effective ${input.latestFx.effectiveAt.slice(0, 10)}.`
        : 'No owner-approved FX reference exists; LBP money is excluded from USD totals instead of being combined incorrectly.',
      'Recognized revenue uses delivered order snapshots. Collected cash uses posted payment entries.',
      'Gross margin includes snapshotted product cost but excludes delivery, packaging, acquisition and overhead.',
      demo
        ? 'Historical points are clearly marked demo workspace history; new activity is read from live operational records.'
        : 'All values are calculated from this business tenant’s operational records.',
    ],
  });
}
