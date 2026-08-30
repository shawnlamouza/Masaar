import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceWorkspace } from './CommerceWorkspace';

const snapshot = {
  summary: {
    activeProducts: 1,
    activeVariants: 1,
    activeSuppliers: 1,
    customers: 0,
    lowStockVariants: 1,
    marginRiskVariants: 0,
    latestFx: null,
  },
  products: [
    {
      id: 'p1',
      tenantId: 't1',
      name: 'Linen Shirt',
      category: 'Apparel',
      active: true,
      trackStock: true,
      variants: [
        {
          id: 'v1',
          sku: 'LIN-S',
          size: 'S',
          available: true,
          stockOnHand: 3,
          currentSellingPrice: { amountMinor: 3500, currency: 'USD' as const },
          currentUnitCost: { amountMinor: 1800, currency: 'USD' as const },
          supplierId: 's1',
          priceHistory: [
            {
              id: 'ph1',
              value: { amountMinor: 3500, currency: 'USD' as const },
              effectiveAt: '2026-08-22T00:00:00.000Z',
              reason: 'Initial',
              recordedBy: 'u1',
            },
          ],
          costHistory: [
            {
              id: 'ch1',
              value: { amountMinor: 1800, currency: 'USD' as const },
              effectiveAt: '2026-08-22T00:00:00.000Z',
              reason: 'Initial',
              recordedBy: 'u1',
            },
          ],
        },
      ],
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    },
  ],
  suppliers: [
    {
      id: 's1',
      tenantId: 't1',
      name: 'Cedar Textiles',
      contactName: '',
      leadTimeDays: 5,
      minimumOrderQuantity: 10,
      active: true,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    },
  ],
  customers: [],
  fxSnapshots: [],
  priceReviews: [],
};

const mocks = vi.hoisted(() => ({ getCommerceSnapshot: vi.fn(), updateProduct: vi.fn() }));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    getCommerceSnapshot: mocks.getCommerceSnapshot,
    updateProduct: mocks.updateProduct,
  };
});

describe('Phase 3 commerce workspace', () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.getCommerceSnapshot.mockResolvedValue(snapshot);
    mocks.updateProduct.mockResolvedValue(snapshot.products[0]);
  });
  it('renders structured catalog data from the API', async () => {
    render(<CommerceWorkspace view="Catalog" role="OWNER" />);
    expect(await screen.findByRole('heading', { name: 'Linen Shirt' })).toBeInTheDocument();
    expect(screen.getAllByText('LIN-S')).toHaveLength(2);
    expect(screen.getByText('Low-stock variants')).toBeInTheDocument();
  });

  it('keeps price-changing controls disabled for read-only users', async () => {
    render(<CommerceWorkspace view="Price Studio" role="READ_ONLY" />);
    expect(await screen.findByRole('heading', { name: 'Price Studio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record reference/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Record cost & preview impact/i })).toBeDisabled();
  });

  it('edits a product from the catalog and sends the full traceable variant model', async () => {
    render(<CommerceWorkspace view="Catalog" role="OWNER" />);
    await screen.findByRole('heading', { name: 'Linen Shirt' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit product Linen Shirt' }));
    const name = screen.getByLabelText('Product name');
    fireEvent.change(name, { target: { value: 'Premium Linen Shirt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product changes' }));
    await waitFor(() =>
      expect(mocks.updateProduct).toHaveBeenCalledWith(
        'OWNER',
        'p1',
        expect.objectContaining({
          name: 'Premium Linen Shirt',
          variants: [expect.objectContaining({ id: 'v1', sku: 'LIN-S' })],
        }),
      ),
    );
  });
});
