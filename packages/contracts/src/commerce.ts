import { z } from 'zod';

export const commerceCurrencySchema = z.enum(['USD', 'LBP']);

export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: commerceCurrencySchema,
});
export type Money = z.infer<typeof moneySchema>;

export const lebanesePhoneSchema = z
  .string()
  .regex(/^\+961\d{7,8}$/, 'Use a valid Lebanese number');

export const addressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(50),
  governorate: z.enum([
    'Beirut',
    'Mount Lebanon',
    'North Lebanon',
    'Akkar',
    'Bekaa',
    'Baalbek-Hermel',
    'South Lebanon',
    'Nabatieh',
  ]),
  area: z.string().min(1).max(80),
  locality: z.string().min(1).max(100),
  street: z.string().max(120).default(''),
  building: z.string().max(100).default(''),
  floor: z.string().max(30).default(''),
  landmark: z.string().max(180).default(''),
  mapUrl: z.string().url().optional(),
  originalWording: z.string().min(3).max(500),
});
export type Address = z.infer<typeof addressSchema>;

export const supplierSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(2).max(120),
  contactName: z.string().max(100).default(''),
  phone: lebanesePhoneSchema.optional(),
  leadTimeDays: z.number().int().min(0).max(365),
  minimumOrderQuantity: z.number().int().positive(),
  lastPurchaseCost: moneySchema.optional(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Supplier = z.infer<typeof supplierSchema>;

export const createSupplierSchema = supplierSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateSupplier = z.infer<typeof createSupplierSchema>;
export const updateSupplierSchema = createSupplierSchema;
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;

export const priceSnapshotSchema = z.object({
  id: z.string().min(1),
  value: moneySchema,
  effectiveAt: z.string().datetime(),
  reason: z.string().min(2).max(240),
  recordedBy: z.string().min(1),
  fxSnapshotId: z.string().optional(),
});
export type PriceSnapshot = z.infer<typeof priceSnapshotSchema>;

export const productVariantSchema = z.object({
  id: z.string().min(1),
  sku: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  size: z.string().max(40).optional(),
  color: z.string().max(40).optional(),
  available: z.boolean(),
  stockOnHand: z.number().int().nonnegative().optional(),
  currentSellingPrice: moneySchema,
  currentUnitCost: moneySchema,
  supplierId: z.string().optional(),
  priceHistory: z.array(priceSnapshotSchema).min(1),
  costHistory: z.array(priceSnapshotSchema).min(1),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  imageUrl: z.string().url().optional(),
  active: z.boolean(),
  trackStock: z.boolean(),
  variants: z.array(productVariantSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductVariantSchema = productVariantSchema
  .omit({ priceHistory: true, costHistory: true })
  .omit({ id: true });

export const createProductSchema = productSchema
  .omit({ id: true, tenantId: true, createdAt: true, updatedAt: true })
  .extend({ variants: z.array(createProductVariantSchema).min(1) });
export type CreateProduct = z.infer<typeof createProductSchema>;

export const updateProductVariantSchema = createProductVariantSchema.extend({
  id: z.string().min(1).optional(),
});
export const updateProductSchema = createProductSchema.extend({
  variants: z.array(updateProductVariantSchema).min(1),
});
export type UpdateProduct = z.infer<typeof updateProductSchema>;

export const paymentPreferenceSchema = z.enum(['CASH', 'WHISH', 'OMT', 'CARD', 'BANK', 'OTHER']);

export const customerOrderStatsSchema = z.object({
  completedOrders: z.number().int().nonnegative(),
  cancelledOrders: z.number().int().nonnegative(),
  failedDeliveries: z.number().int().nonnegative(),
  lifetimeSpendUsdMinor: z.number().int().nonnegative(),
  lastOrderAt: z.string().datetime().optional(),
});

export const customerSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(2).max(120),
  phoneOriginal: z.string().min(5).max(30),
  phoneNormalized: lebanesePhoneSchema,
  preferredPaymentMethod: paymentPreferenceSchema,
  addresses: z.array(addressSchema),
  orderStats: customerOrderStatsSchema,
  tags: z.array(z.string().min(1).max(40)).max(12),
  notes: z.string().max(500).default(''),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Customer = z.infer<typeof customerSchema>;

export const createAddressSchema = addressSchema.omit({ id: true });
export const createCustomerSchema = customerSchema
  .omit({
    id: true,
    tenantId: true,
    phoneNormalized: true,
    orderStats: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({ addresses: z.array(createAddressSchema).default([]) });
export type CreateCustomer = z.infer<typeof createCustomerSchema>;
export const updateCustomerSchema = createCustomerSchema;
export type UpdateCustomer = z.infer<typeof updateCustomerSchema>;

export const duplicateCustomerReviewSchema = z.object({
  normalizedPhone: lebanesePhoneSchema,
  matches: z.array(customerSchema),
  exactMatch: z.boolean(),
});
export type DuplicateCustomerReview = z.infer<typeof duplicateCustomerReviewSchema>;

export const fxSnapshotSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  baseCurrency: z.literal('USD'),
  quoteCurrency: z.literal('LBP'),
  lbpPerUsd: z.number().positive(),
  effectiveAt: z.string().datetime(),
  source: z.literal('OWNER_ENTERED'),
  note: z.string().min(2).max(240),
  recordedBy: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type FxSnapshot = z.infer<typeof fxSnapshotSchema>;

export const createFxSnapshotSchema = fxSnapshotSchema.omit({
  id: true,
  tenantId: true,
  source: true,
  recordedBy: true,
  createdAt: true,
  baseCurrency: true,
  quoteCurrency: true,
});
export type CreateFxSnapshot = z.infer<typeof createFxSnapshotSchema>;

export const priceReviewItemSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  variantId: z.string().min(1),
  sku: z.string().min(1),
  oldUnitCost: moneySchema,
  newUnitCost: moneySchema,
  currentSellingPrice: moneySchema,
  recommendedSellingPrice: moneySchema,
  oldMarginBps: z.number().int(),
  newMarginBps: z.number().int(),
  approved: z.boolean(),
});
export type PriceReviewItem = z.infer<typeof priceReviewItemSchema>;

export const priceReviewSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  supplierId: z.string().min(1),
  supplierName: z.string().min(1),
  fxSnapshotId: z.string().min(1),
  targetMarginBps: z.number().int().min(500).max(9000),
  status: z.enum(['PENDING', 'PARTIALLY_APPROVED', 'APPROVED']),
  items: z.array(priceReviewItemSchema).min(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  approvedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(),
});
export type PriceReview = z.infer<typeof priceReviewSchema>;

export const createSupplierCostReviewSchema = z.object({
  supplierId: z.string().min(1),
  fxSnapshotId: z.string().min(1),
  newUnitCost: moneySchema,
  targetMarginBps: z.number().int().min(500).max(9000).default(4000),
  effectiveAt: z.string().datetime(),
  reason: z.string().min(3).max(240),
});
export type CreateSupplierCostReview = z.infer<typeof createSupplierCostReviewSchema>;

export const approvePriceReviewSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  reason: z.string().min(3).max(240),
});
export type ApprovePriceReview = z.infer<typeof approvePriceReviewSchema>;

export const commerceSummarySchema = z.object({
  activeProducts: z.number().int().nonnegative(),
  activeVariants: z.number().int().nonnegative(),
  activeSuppliers: z.number().int().nonnegative(),
  customers: z.number().int().nonnegative(),
  lowStockVariants: z.number().int().nonnegative(),
  marginRiskVariants: z.number().int().nonnegative(),
  latestFx: fxSnapshotSchema.nullable(),
});
export type CommerceSummary = z.infer<typeof commerceSummarySchema>;
