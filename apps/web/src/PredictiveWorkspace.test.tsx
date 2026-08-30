import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PredictiveSnapshot } from '@masaar/contracts';
import { PredictiveWorkspace } from './PredictiveWorkspace';

const snapshot: PredictiveSnapshot = {
  generatedAt: '2026-08-24T10:00:00.000Z',
  period: '30D',
  dataMode: 'DEMO_WITH_HISTORY',
  forecast: {
    horizonDays: 14,
    expectedRevenueMinor: 42000,
    lowRevenueMinor: 32000,
    highRevenueMinor: 53000,
    expectedOrders: 12,
    confidence: 'MEDIUM',
    historyDays: 30,
    method: 'Recency-weighted range.',
    points: Array.from({ length: 14 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      expectedRevenueMinor: 3000,
      lowRevenueMinor: 2200,
      highRevenueMinor: 3800,
      expectedOrders: 1,
    })),
  },
  anomalies: [
    {
      id: 'cash',
      kind: 'PAYMENT',
      severity: 'HIGH',
      title: 'Cash remains outside',
      observed: '$39',
      expected: '$0',
      deviationPercent: 100,
      explanation: 'Custody evidence.',
      target: 'Payments',
    },
  ],
  restock: [
    {
      variantId: 'v1',
      sku: 'LIN-M-SAND',
      productName: 'Linen Shirt',
      availableUnits: 3,
      forecastDemand14Days: 8,
      safetyUnits: 2,
      recommendedUnits: 7,
      estimatedCashMinor: 12600,
      estimatedStockoutDate: '2026-09-08',
      supplierLeadTimeDays: 6,
      confidence: 'MEDIUM',
      explanation: 'Demand plus lead time.',
    },
  ],
  deliveryRisks: [
    {
      area: 'Achrafieh',
      governorate: 'Beirut',
      riskScore: 42,
      band: 'HIGH',
      predictedFailurePercent: 31,
      sampleSize: 12,
      factors: ['Recorded failures'],
      recommendation: 'Confirm address.',
    },
  ],
  customerReliability: [
    {
      customerId: 'c1',
      customerName: 'Omar Saab',
      indicator: 'CAUTION',
      evidenceScore: 68,
      completedOrders: 2,
      cancelledOrders: 1,
      failedDeliveries: 0,
      explanation: 'Recorded order history.',
      recommendation: 'Reconfirm delivery.',
    },
  ],
  scenarioDefaults: {
    averageOrderMinor: 3500,
    grossMarginPercent: 48,
    monthlyFixedCostsMinor: 150000,
    monthlyMarketingMinor: 30000,
  },
  governance: {
    forecastReady: true,
    anomalyReady: true,
    customerPredictionReady: true,
    assistantMode: 'GROUNDED_RULE_ENGINE',
    limitations: [
      'Forecasts are not promises.',
      'No autonomous decisions.',
      'Customer reliability is never a blacklist.',
      'Tenant scoped.',
    ],
  },
  suggestedQuestions: ['Which products should I restock?', 'Where are deliveries most risky?'],
};

const mocks = vi.hoisted(() => ({ getPredictiveSnapshot: vi.fn(), askMasaar: vi.fn() }));
vi.mock('./api', () => mocks);

describe('Phase 8 Forecast & AI workspace', () => {
  beforeEach(() => {
    mocks.getPredictiveSnapshot.mockResolvedValue(snapshot);
    mocks.askMasaar.mockResolvedValue({
      generatedAt: '2026-08-24T10:00:00.000Z',
      mode: 'GROUNDED_RULE_ENGINE',
      question: 'Which products should I restock?',
      answer: 'Review Linen Shirt.',
      facts: ['3 available'],
      actions: [{ label: 'Review Stock Control', target: 'Stock Control' }],
      caveat: 'Grounded only.',
    });
  });
  afterEach(cleanup);

  it('shows governed forecast, scenario and reliability surfaces', async () => {
    render(<PredictiveWorkspace role="OWNER" onOpenView={vi.fn()} />);
    expect(
      await screen.findByRole('heading', { name: /see around the corner/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('A range you can plan around')).toBeInTheDocument();
    expect(screen.getByText('What must be true to break even?')).toBeInTheDocument();
    expect(screen.getByText('Caution without blacklisting')).toBeInTheDocument();
  });

  it('asks the grounded assistant and opens its operational action', async () => {
    const onOpenView = vi.fn();
    render(<PredictiveWorkspace role="OWNER" onOpenView={onOpenView} />);
    await screen.findByText('Ask the business—not the internet.');
    fireEvent.click(screen.getByRole('button', { name: 'Which products should I restock?' }));
    expect(await screen.findByText('Review Linen Shirt.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review Stock Control/i }));
    expect(onOpenView).toHaveBeenCalledWith('Stock Control');
  });
});
