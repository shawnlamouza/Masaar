import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntelligenceSnapshot } from '@masaar/contracts';
import { BusinessIntelligenceWorkspace } from './BusinessIntelligenceWorkspace';

const snapshot: IntelligenceSnapshot = {
  generatedAt: '2026-08-24T10:00:00.000Z',
  period: '30D',
  periodLabel: 'Last 30 days',
  dataMode: 'DEMO_WITH_HISTORY',
  currency: 'USD',
  metrics: [
    {
      id: 'revenue',
      label: 'Recognized revenue',
      value: 120000,
      previousValue: 100000,
      changePercent: 20,
      unit: 'MONEY_MINOR',
      currency: 'USD',
      direction: 'UP_IS_GOOD',
      definition: 'Delivered value.',
      sourceCount: 12,
      completeness: 100,
    },
  ],
  trend: [
    {
      date: '2026-08-01',
      revenueMinor: 40000,
      grossProfitMinor: 18000,
      collectedMinor: 35000,
      orders: 4,
      delivered: 3,
    },
    {
      date: '2026-08-10',
      revenueMinor: 80000,
      grossProfitMinor: 36000,
      collectedMinor: 70000,
      orders: 8,
      delivered: 7,
    },
  ],
  channels: [
    {
      channel: 'INSTAGRAM',
      revenueMinor: 120000,
      grossProfitMinor: 54000,
      orders: 12,
      averageOrderMinor: 10000,
      sharePercent: 100,
    },
  ],
  products: [
    {
      productId: 'p1',
      productName: 'Linen Shirt',
      units: 12,
      revenueMinor: 120000,
      grossProfitMinor: 54000,
      marginPercent: 45,
      availableUnits: 3,
      stockCoverDays: 9,
      signal: 'RESTOCK',
    },
  ],
  areas: [
    {
      area: 'Achrafieh',
      governorate: 'Beirut',
      orders: 12,
      revenueMinor: 120000,
      deliverySuccessPercent: 83,
      failedDeliveries: 2,
      averageOrderMinor: 10000,
    },
  ],
  failureMix: [{ reason: 'INCORRECT_ADDRESS', count: 2, percent: 100 }],
  cash: {
    recognizedRevenueMinor: 120000,
    collectedMinor: 105000,
    outstandingMinor: 15000,
    cashHeldMinor: 3900,
    inventoryValueMinor: 72000,
    suggestedRestockMinor: 21600,
    refundsMinor: 0,
  },
  customers: {
    activeCustomers: 9,
    repeatCustomers: 3,
    repeatRatePercent: 33.3,
    estimatedLifetimeValueMinor: 13333,
  },
  delivery: {
    attempted: 12,
    delivered: 10,
    successPercent: 83.3,
    firstAttemptSuccessPercent: 75,
    knownCostMinor: 4200,
  },
  insights: [
    {
      id: 'cash',
      severity: 'CRITICAL',
      title: 'Collected cash is still outside the business',
      explanation: 'Cash remains with a driver.',
      impact: '$39.00 is held.',
      recommendation: 'Complete handover.',
      confidence: 'HIGH',
      target: 'Payments',
    },
  ],
  methodology: ['Recognized revenue and collected cash stay separate.'],
};

const getIntelligenceSnapshot = vi.hoisted(() => vi.fn());
vi.mock('./api', async () => ({ getIntelligenceSnapshot }));

describe('Phase 7 Business Intelligence workspace', () => {
  beforeEach(() => getIntelligenceSnapshot.mockResolvedValue(snapshot));
  afterEach(cleanup);

  it('shows the decision hierarchy and opens its source workflow', async () => {
    const onOpenView = vi.fn();
    render(<BusinessIntelligenceWorkspace role="OWNER" onOpenView={onOpenView} />);
    expect(await screen.findByRole('heading', { name: /the business,/i })).toBeInTheDocument();
    expect(screen.getByText('Revenue, profit and cash—separately')).toBeInTheDocument();
    expect(
      screen.getAllByText('Collected cash is still outside the business').length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /take action in payments/i }));
    expect(onOpenView).toHaveBeenCalledWith('Payments');
  });

  it('loads a new calculation window when the period changes', async () => {
    render(<BusinessIntelligenceWorkspace role="OWNER" onOpenView={vi.fn()} />);
    expect((await screen.findAllByText('Recognized revenue')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(getIntelligenceSnapshot).toHaveBeenLastCalledWith('OWNER', '7D');
  });
});
