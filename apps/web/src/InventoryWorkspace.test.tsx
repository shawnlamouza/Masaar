import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryWorkspace } from './InventoryWorkspace';

const inventory = {
  generatedAt: '2026-08-24T00:00:00.000Z',
  summary: {
    trackedVariants: 1,
    unitsOnHand: 4,
    unitsReserved: 1,
    unitsAvailable: 3,
    lowStockVariants: 1,
    outOfStockVariants: 0,
    inventoryValueByCurrency: [{ currency: 'USD' as const, amountMinor: 7200 }],
    suggestedRestockByCurrency: [{ currency: 'USD' as const, amountMinor: 21600 }],
  },
  items: [
    {
      productId: 'p1',
      productName: 'Linen Shirt',
      variantId: 'v1',
      sku: 'LIN-M-SAND',
      variantLabel: 'M · Sand',
      onHand: 4,
      reserved: 1,
      available: 3,
      lowStockThreshold: 3,
      supplierId: 's1',
      supplierName: 'Cedar Textiles',
      supplierLeadTimeDays: 6,
      unitCost: { amountMinor: 1800, currency: 'USD' as const },
      sellingPrice: { amountMinor: 3500, currency: 'USD' as const },
      soldLast30Days: 1,
      stockCoverDays: 90,
      suggestedRestockQuantity: 12,
      suggestedRestockCost: { amountMinor: 21600, currency: 'USD' as const },
      state: 'LOW' as const,
    },
  ],
  movements: [],
  returns: [],
};

const mocks = vi.hoisted(() => ({
  getInventorySnapshot: vi.fn(),
  listOrders: vi.fn(),
  getCommerceSnapshot: vi.fn(),
}));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    getInventorySnapshot: mocks.getInventorySnapshot,
    listOrders: mocks.listOrders,
    getCommerceSnapshot: mocks.getCommerceSnapshot,
  };
});

describe('Phase 6 inventory workspace', () => {
  beforeEach(() => {
    mocks.getInventorySnapshot.mockResolvedValue(inventory);
    mocks.listOrders.mockResolvedValue([]);
    mocks.getCommerceSnapshot.mockResolvedValue({
      summary: {},
      products: [],
      suppliers: [],
      customers: [],
      fxSnapshots: [],
      priceReviews: [],
    });
  });

  it('shows employees operational stock truth without owner correction controls', async () => {
    render(<InventoryWorkspace view="Stock Control" role="EMPLOYEE" />);
    expect(await screen.findByRole('heading', { name: 'Stock Control' })).toBeInTheDocument();
    expect(screen.getByText('LIN-M-SAND · M · Sand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receive stock' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Physical count' })).not.toBeInTheDocument();
  });

  it('gives owners controlled physical-count access', async () => {
    render(<InventoryWorkspace view="Stock Control" role="OWNER" />);
    expect(await screen.findByRole('button', { name: 'Physical count' })).toBeInTheDocument();
  });
});
