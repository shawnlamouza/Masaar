import {
  assistantResponseSchema,
  predictiveSnapshotSchema,
  type AssistantResponse,
  type Customer,
  type IntelligenceSnapshot,
  type InventoryStockItem,
  type PredictiveSnapshot,
} from '@masaar/contracts';

type PredictiveInputs = {
  intelligence: IntelligenceSnapshot;
  inventoryItems: InventoryStockItem[];
  customers: Customer[];
};

const PERIOD_DAYS = { '7D': 7, '30D': 30, '90D': 90 } as const;
const round1 = (value: number) => Math.round(value * 10) / 10;
const money = (minor: number) => `$${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;

function confidence(sample: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  return sample >= 30 ? 'HIGH' : sample >= 12 ? 'MEDIUM' : 'LOW';
}

export function buildPredictiveSnapshot(input: PredictiveInputs): PredictiveSnapshot {
  const { intelligence, inventoryItems, customers } = input;
  const periodDays = PERIOD_DAYS[intelligence.period];
  const bucketDays = intelligence.period === '90D' ? 7 : intelligence.period === '30D' ? 3 : 1;
  const dailyRevenue = intelligence.trend.map((point) => point.revenueMinor / bucketDays);
  const dailyOrders = intelligence.trend.map((point) => point.orders / bucketDays);
  const weighted = (values: number[]) => {
    if (!values.length) return 0;
    const weights = values.map((_, index) => index + 1);
    return (
      values.reduce((sum, value, index) => sum + value * weights[index]!, 0) /
      weights.reduce((sum, value) => sum + value, 0)
    );
  };
  const expectedDailyRevenue = weighted(dailyRevenue.slice(-6));
  const expectedDailyOrders = weighted(dailyOrders.slice(-6));
  const average = dailyRevenue.length
    ? dailyRevenue.reduce((sum, value) => sum + value, 0) / dailyRevenue.length
    : 0;
  const standardDeviation = dailyRevenue.length
    ? Math.sqrt(
        dailyRevenue.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) /
          dailyRevenue.length,
      )
    : 0;
  const uncertainty =
    average > 0 ? Math.min(0.48, Math.max(0.15, standardDeviation / average)) : 0.45;
  const lastHistoryDate = intelligence.trend.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  const forecastStart = Date.parse(`${lastHistoryDate}T12:00:00.000Z`) + 86_400_000;
  const weekdayFactors = [0.82, 0.88, 0.96, 1.04, 1.13, 1.2, 0.97];
  const points = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(forecastStart + index * 86_400_000);
    const factor = weekdayFactors[date.getUTCDay()]!;
    const expected = Math.max(0, Math.round(expectedDailyRevenue * factor));
    return {
      date: date.toISOString().slice(0, 10),
      expectedRevenueMinor: expected,
      lowRevenueMinor: Math.max(0, Math.round(expected * (1 - uncertainty))),
      highRevenueMinor: Math.round(expected * (1 + uncertainty)),
      expectedOrders: round1(expectedDailyOrders * factor),
    };
  });
  const expectedRevenue = points.reduce((sum, point) => sum + point.expectedRevenueMinor, 0);
  const lowRevenue = points.reduce((sum, point) => sum + point.lowRevenueMinor, 0);
  const highRevenue = points.reduce((sum, point) => sum + point.highRevenueMinor, 0);
  const expectedOrders = round1(points.reduce((sum, point) => sum + point.expectedOrders, 0));
  const sourceCount =
    intelligence.metrics.find((metric) => metric.id === 'revenue')?.sourceCount ?? 0;
  const forecastConfidence = confidence(sourceCount);

  const averageOrder =
    intelligence.metrics.find((metric) => metric.id === 'average-order')?.value ?? 0;
  const grossMargin =
    intelligence.metrics.find((metric) => metric.id === 'gross-margin')?.value ?? 0;
  const productPerformance = new Map(
    intelligence.products.map((product) => [product.productId, product] as const),
  );
  const variantsByProduct = new Map<string, number>();
  for (const item of inventoryItems)
    variantsByProduct.set(item.productId, (variantsByProduct.get(item.productId) ?? 0) + 1);
  const restock = inventoryItems
    .map((item) => {
      const performance = productPerformance.get(item.productId);
      const productDaily = (performance?.units ?? 0) / periodDays;
      const variantShare = 1 / (variantsByProduct.get(item.productId) ?? 1);
      const operationalDaily = item.soldLast30Days / 30;
      const forecastDaily = Math.max(operationalDaily, productDaily * variantShare);
      const demand = Math.ceil(forecastDaily * 14);
      const leadTime = item.supplierLeadTimeDays ?? 7;
      const safety = Math.max(1, Math.ceil(forecastDaily * Math.max(3, leadTime * 0.35)));
      const recommended = Math.max(
        item.suggestedRestockQuantity,
        demand + safety - Math.max(0, item.available),
      );
      const daysToStockout = forecastDaily > 0 ? item.available / forecastDaily : null;
      return {
        variantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        availableUnits: item.available,
        forecastDemand14Days: demand,
        safetyUnits: safety,
        recommendedUnits: recommended,
        estimatedCashMinor: recommended * item.unitCost.amountMinor,
        estimatedStockoutDate:
          daysToStockout !== null && daysToStockout <= 60
            ? new Date(Date.now() + Math.max(0, daysToStockout) * 86_400_000)
                .toISOString()
                .slice(0, 10)
            : null,
        supplierLeadTimeDays: item.supplierLeadTimeDays ?? null,
        confidence: confidence(performance?.units ?? item.soldLast30Days),
        explanation: `Uses ${round1(forecastDaily)} expected units/day, ${leadTime}-day lead time, ${safety} safety units and ${item.available} currently available.`,
      };
    })
    .filter((item) => item.recommendedUnits > 0 || item.estimatedStockoutDate)
    .sort((a, b) => b.estimatedCashMinor - a.estimatedCashMinor);

  const deliveryRisks = intelligence.areas
    .map((area) => {
      const failure = 100 - area.deliverySuccessPercent;
      const smallSamplePenalty = area.orders < 5 ? 12 : area.orders < 10 ? 5 : 0;
      const riskScore = Math.min(100, round1(failure * 0.78 + smallSamplePenalty));
      const factors = [
        `${area.deliverySuccessPercent}% historical delivery success`,
        `${area.orders} recorded orders in the selected period`,
        ...(area.failedDeliveries ? [`${area.failedDeliveries} recorded failures`] : []),
        ...(area.orders < 5 ? ['Small sample increases uncertainty'] : []),
      ];
      return {
        area: area.area,
        governorate: area.governorate,
        riskScore,
        band: (riskScore >= 35 ? 'HIGH' : riskScore >= 18 ? 'MEDIUM' : 'LOW') as
          'HIGH' | 'MEDIUM' | 'LOW',
        predictedFailurePercent: round1(Math.min(100, failure + smallSamplePenalty * 0.35)),
        sampleSize: area.orders,
        factors,
        recommendation:
          riskScore >= 35
            ? 'Confirm the standardized address, landmark and customer availability before dispatch.'
            : riskScore >= 18
              ? 'Send a confirmation reminder and preserve the driver’s failed-reason evidence.'
              : 'Use the normal confirmation and delivery workflow.',
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const customerReliability = customers
    .map((customer) => {
      const stats = customer.orderStats;
      const total = stats.completedOrders + stats.cancelledOrders + stats.failedDeliveries;
      const completedRate = total ? (stats.completedOrders / total) * 100 : 50;
      const evidenceScore = Math.max(
        0,
        Math.min(
          100,
          round1(completedRate - stats.cancelledOrders * 8 - stats.failedDeliveries * 5),
        ),
      );
      const indicator =
        total < 2
          ? 'NORMAL'
          : evidenceScore < 55
            ? 'EXTRA_CONFIRMATION'
            : evidenceScore < 75
              ? 'CAUTION'
              : 'NORMAL';
      return {
        customerId: customer.id,
        customerName: customer.name,
        indicator,
        evidenceScore,
        completedOrders: stats.completedOrders,
        cancelledOrders: stats.cancelledOrders,
        failedDeliveries: stats.failedDeliveries,
        explanation:
          total < 2
            ? 'There is not enough order history for a meaningful caution signal.'
            : `${stats.completedOrders} completed, ${stats.cancelledOrders} cancelled and ${stats.failedDeliveries} failed-delivery records contribute to this indicator.`,
        recommendation:
          indicator === 'EXTRA_CONFIRMATION'
            ? 'Confirm address and availability and consider a partial prepayment. Never refuse automatically.'
            : indicator === 'CAUTION'
              ? 'Ask the employee to reconfirm delivery details before preparation.'
              : 'Use the normal order-confirmation workflow.',
      };
    })
    .sort((a, b) => a.evidenceScore - b.evidenceScore);

  const anomalies: PredictiveSnapshot['anomalies'] = [];
  const values = intelligence.trend.map((point) => point.revenueMinor);
  if (values.length >= 5) {
    const baseline = values.slice(0, -1);
    const baselineAverage = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
    const latest = values.at(-1) ?? 0;
    const deviation = baselineAverage ? ((latest - baselineAverage) / baselineAverage) * 100 : 0;
    if (Math.abs(deviation) >= 35)
      anomalies.push({
        id: 'revenue-latest',
        kind: 'REVENUE',
        severity: Math.abs(deviation) >= 65 ? 'HIGH' : 'MEDIUM',
        title: `Latest revenue is ${deviation >= 0 ? 'above' : 'below'} its recent pattern`,
        observed: money(latest),
        expected: money(Math.round(baselineAverage)),
        deviationPercent: round1(deviation),
        explanation:
          'Masaar compares the newest period bucket with earlier buckets. It flags the change; it does not invent a cause.',
        target: 'Intelligence',
      });
  }
  if (intelligence.cash.cashHeldMinor > 0)
    anomalies.push({
      id: 'cash-held',
      kind: 'PAYMENT',
      severity: 'HIGH',
      title: 'Collected cash remains outside the register',
      observed: money(intelligence.cash.cashHeldMinor),
      expected: '$0 after approved close',
      deviationPercent: 100,
      explanation:
        'This is a custody exception from posted cash movements, not a statistical guess.',
      target: 'Payments',
    });
  const riskiestArea = deliveryRisks[0];
  if (riskiestArea && riskiestArea.band !== 'LOW')
    anomalies.push({
      id: `delivery-${riskiestArea.area}`,
      kind: 'DELIVERY',
      severity: riskiestArea.band === 'HIGH' ? 'HIGH' : 'MEDIUM',
      title: `${riskiestArea.area} needs stronger delivery confirmation`,
      observed: `${riskiestArea.predictedFailurePercent}% estimated failure risk`,
      expected: 'Below 15%',
      deviationPercent: round1(riskiestArea.predictedFailurePercent - 15),
      explanation: riskiestArea.factors.join(' · '),
      target: 'Delivery',
    });
  if (restock.length)
    anomalies.push({
      id: 'forecast-stock',
      kind: 'INVENTORY',
      severity: restock.some((item) => item.availableUnits <= 0) ? 'HIGH' : 'MEDIUM',
      title: 'Forecast demand is pressing against available stock',
      observed: `${restock.length} variant${restock.length === 1 ? '' : 's'} need a decision`,
      expected: 'Demand covered through supplier lead time',
      deviationPercent: 0,
      explanation:
        'The recommendation combines recent demand, current availability, supplier lead time and safety units.',
      target: 'Stock Control',
    });

  const forecastReady = sourceCount >= 12;
  const anomalyReady = intelligence.trend.length >= 5;
  const customerPredictionReady = customers.some(
    (customer) =>
      customer.orderStats.completedOrders +
        customer.orderStats.cancelledOrders +
        customer.orderStats.failedDeliveries >=
      3,
  );
  return predictiveSnapshotSchema.parse({
    generatedAt: new Date().toISOString(),
    period: intelligence.period,
    dataMode: intelligence.dataMode,
    forecast: {
      horizonDays: 14,
      expectedRevenueMinor: expectedRevenue,
      lowRevenueMinor: lowRevenue,
      highRevenueMinor: highRevenue,
      expectedOrders,
      confidence: forecastConfidence,
      historyDays: periodDays,
      method:
        'Recency-weighted daily average with observed volatility range and weekday adjustment.',
      points,
    },
    anomalies: anomalies.slice(0, 6),
    restock,
    deliveryRisks,
    customerReliability,
    scenarioDefaults: {
      averageOrderMinor: Math.max(0, Math.round(averageOrder)),
      grossMarginPercent: Math.max(0, Math.min(100, grossMargin)),
      monthlyFixedCostsMinor: intelligence.dataMode === 'DEMO_WITH_HISTORY' ? 150000 : 0,
      monthlyMarketingMinor: intelligence.dataMode === 'DEMO_WITH_HISTORY' ? 30000 : 0,
    },
    governance: {
      forecastReady,
      anomalyReady,
      customerPredictionReady,
      assistantMode: 'GROUNDED_RULE_ENGINE',
      limitations: [
        'Forecasts are ranges based on recorded history, not promises or autonomous decisions.',
        'No recommendation changes price, inventory, customer status or delivery automatically.',
        'Customer reliability is private, explainable caution guidance and never a blacklist.',
        'Cross-business data is not used. Every result remains tenant-scoped.',
      ],
    },
    suggestedQuestions: [
      'What should I do first today?',
      'Which products should I restock?',
      'Where are deliveries most risky?',
      'How much revenue could the next 14 days generate?',
      'Which customers need extra confirmation?',
    ],
  });
}

export function answerGroundedQuestion(
  question: string,
  predictive: PredictiveSnapshot,
  intelligence: IntelligenceSnapshot,
): AssistantResponse {
  const normalized = question.toLowerCase();
  let answer: string;
  let facts: string[];
  let actions: AssistantResponse['actions'];
  if (/stock|restock|inventory|supplier/.test(normalized)) {
    const priority = predictive.restock[0];
    answer = priority
      ? `${priority.productName} (${priority.sku}) is the first stock decision. Masaar estimates ${priority.forecastDemand14Days} units of 14-day demand and recommends reviewing ${priority.recommendedUnits} units before approving a purchase.`
      : 'Current availability covers the forecast window; no forecast-driven restock is urgent.';
    facts = priority
      ? [
          `${priority.availableUnits} units currently available`,
          `${priority.safetyUnits} safety units included`,
          `${money(priority.estimatedCashMinor)} estimated purchase cash`,
        ]
      : ['No variant currently crosses the forecast restock threshold.'];
    actions = [{ label: 'Review Stock Control', target: 'Stock Control' }];
  } else if (/deliver|area|driver|address|late|fail/.test(normalized)) {
    const risk = predictive.deliveryRisks[0];
    answer = risk
      ? `${risk.area} has the highest current delivery caution at ${risk.riskScore}/100. ${risk.recommendation}`
      : 'There is not enough delivery history to rank area risk yet.';
    facts = risk?.factors ?? ['More completed delivery attempts are required.'];
    actions = [{ label: 'Open Delivery', target: 'Delivery' }];
  } else if (/customer|reliable|cancel|prepay/.test(normalized)) {
    const caution = predictive.customerReliability.find((item) => item.indicator !== 'NORMAL');
    answer = caution
      ? `${caution.customerName} has a ${caution.indicator.toLowerCase().replaceAll('_', ' ')} indicator. ${caution.recommendation}`
      : 'No identified customer currently requires extra confirmation based on recorded history.';
    facts = caution
      ? [
          `${caution.completedOrders} completed orders`,
          `${caution.cancelledOrders} cancellations`,
          `${caution.failedDeliveries} failed deliveries`,
        ]
      : ['The indicator does not blacklist or automatically refuse any customer.'];
    actions = [{ label: 'Review Customers', target: 'Customers' }];
  } else if (/forecast|next|revenue|sales|grow/.test(normalized)) {
    answer = `The governed 14-day forecast is ${money(predictive.forecast.expectedRevenueMinor)}, with a range from ${money(predictive.forecast.lowRevenueMinor)} to ${money(predictive.forecast.highRevenueMinor)}. Treat the range as planning evidence, not a promise.`;
    facts = [
      `${predictive.forecast.expectedOrders} expected orders`,
      `${predictive.forecast.confidence.toLowerCase()} confidence`,
      `${predictive.forecast.historyDays} days of history selected`,
    ];
    actions = [{ label: 'Open Forecast & AI', target: 'Forecast & AI' }];
  } else if (/cash|payment|money|collect|driver hold/.test(normalized)) {
    answer = intelligence.cash.cashHeldMinor
      ? `${money(intelligence.cash.cashHeldMinor)} of collected cash is still assigned outside the business register. Complete custody handover before treating it as available business cash.`
      : 'No collected cash is currently recorded outside the business register.';
    facts = [
      `${money(intelligence.cash.collectedMinor)} collected in the selected period`,
      `${money(intelligence.cash.outstandingMinor)} still outstanding`,
    ];
    actions = [{ label: 'Review Payments', target: 'Payments' }];
  } else {
    const first = predictive.anomalies[0];
    answer = first
      ? `Start with this: ${first.title}. ${first.explanation}`
      : `The next 14-day planning range is ${money(predictive.forecast.lowRevenueMinor)} to ${money(predictive.forecast.highRevenueMinor)} and no high-priority anomaly is currently detected.`;
    facts = [
      `${money(predictive.forecast.expectedRevenueMinor)} expected 14-day revenue`,
      `${predictive.anomalies.length} detected exception${predictive.anomalies.length === 1 ? '' : 's'}`,
      `${predictive.restock.length} forecast restock decision${predictive.restock.length === 1 ? '' : 's'}`,
    ];
    actions = first
      ? [{ label: `Open ${first.target}`, target: first.target }]
      : [{ label: 'Open Intelligence', target: 'Intelligence' }];
  }
  return assistantResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    mode: 'GROUNDED_RULE_ENGINE',
    question,
    answer,
    facts,
    actions,
    caveat:
      'This answer uses Masaar records and transparent rules. It cannot know unrecorded expenses, conversations, market events or future certainty.',
  });
}
