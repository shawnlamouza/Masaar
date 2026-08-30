import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  lebanesePhoneSchema,
  moneySchema,
  productSchema,
} from './commerce.js';

describe('Phase 3 commerce contracts', () => {
  it('keeps currency explicit and rejects fractional storage values', () => {
    expect(moneySchema.safeParse({ amountMinor: 2300, currency: 'USD' }).success).toBe(true);
    expect(moneySchema.safeParse({ amountMinor: 23.5, currency: 'USD' }).success).toBe(false);
    expect(moneySchema.safeParse({ amountMinor: 2300, currency: 'EUR' }).success).toBe(false);
  });

  it('accepts canonical Lebanese phone numbers only', () => {
    expect(lebanesePhoneSchema.safeParse('+96170123456').success).toBe(true);
    expect(lebanesePhoneSchema.safeParse('70 123 456').success).toBe(false);
  });

  it('rejects invalid and empty product variants', () => {
    const result = createProductSchema.safeParse({
      name: 'Linen Shirt',
      category: 'Apparel',
      active: true,
      trackStock: true,
      variants: [],
    });
    expect(result.success).toBe(false);
  });

  it('requires current product economics to have immutable history', () => {
    const result = productSchema.safeParse({
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
          available: true,
          currentSellingPrice: { amountMinor: 3500, currency: 'USD' },
          currentUnitCost: { amountMinor: 1800, currency: 'USD' },
          priceHistory: [],
          costHistory: [],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
