import { z } from 'zod';
import { commerceCurrencySchema, moneySchema, paymentPreferenceSchema } from './commerce.js';

export const inventoryMovementTypeSchema = z.enum([
  'OPENING',
  'RECEIPT',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'SALE',
  'CUSTOMER_RETURN',
  'SUPPLIER_RETURN',
  'EXCHANGE_IN',
  'EXCHANGE_OUT',
  'DAMAGE',
  'LOSS',
  'ADJUSTMENT',
]);
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>;

export const inventoryMovementSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  variantId: z.string().min(1),
  sku: z.string().min(1),
  type: inventoryMovementTypeSchema,
  quantity: z.number().int().positive(),
  onHandDelta: z.number().int(),
  reservedDelta: z.number().int(),
  locationId: z.literal('main'),
  sourceType: z.enum(['OPENING', 'ORDER', 'RECEIPT', 'RETURN', 'MANUAL']),
  sourceId: z.string().min(1),
  reason: z.string().min(2).max(300),
  unitCost: moneySchema.optional(),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
});
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;

export const inventoryStockItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  variantId: z.string().min(1),
  sku: z.string().min(1),
  variantLabel: z.string(),
  onHand: z.number().int(),
  reserved: z.number().int().nonnegative(),
  available: z.number().int(),
  lowStockThreshold: z.number().int().nonnegative(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  supplierLeadTimeDays: z.number().int().nonnegative().optional(),
  unitCost: moneySchema,
  sellingPrice: moneySchema,
  soldLast30Days: z.number().int().nonnegative(),
  stockCoverDays: z.number().nonnegative().nullable(),
  suggestedRestockQuantity: z.number().int().nonnegative(),
  suggestedRestockCost: moneySchema,
  state: z.enum(['OUT', 'LOW', 'HEALTHY', 'OVERSTOCKED', 'UNTRACKED']),
});
export type InventoryStockItem = z.infer<typeof inventoryStockItemSchema>;

export const returnReasonSchema = z.enum([
  'WRONG_SIZE_OR_VARIANT',
  'DAMAGED_ITEM',
  'NOT_AS_EXPECTED',
  'CUSTOMER_CHANGED_MIND',
  'DELIVERY_FAILURE',
  'OTHER',
]);
export const returnConditionSchema = z.enum(['SEALED', 'SELLABLE', 'OPENED', 'DAMAGED']);
export const returnDispositionSchema = z.enum([
  'RESTOCK',
  'QUARANTINE',
  'DAMAGED_WRITE_OFF',
  'RETURN_TO_SUPPLIER',
]);

export const returnCaseItemSchema = z.object({
  orderLineId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  variantId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: moneySchema,
  replacementVariantId: z.string().optional(),
  condition: returnConditionSchema.optional(),
  disposition: returnDispositionSchema.optional(),
});

export const returnCaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  customerName: z.string().min(1),
  type: z.enum(['RETURN', 'EXCHANGE']),
  status: z.enum(['OPEN', 'RECEIVED', 'RESOLVED', 'CANCELLED']),
  reason: returnReasonSchema,
  note: z.string().max(500).default(''),
  items: z.array(returnCaseItemSchema).min(1),
  refundAmount: moneySchema.optional(),
  refundMethod: paymentPreferenceSchema.optional(),
  refundReference: z.string().max(120).optional(),
  replacementOrderId: z.string().optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
  receivedBy: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  resolvedBy: z.string().optional(),
});
export type ReturnCase = z.infer<typeof returnCaseSchema>;

export const inventorySnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  summary: z.object({
    trackedVariants: z.number().int().nonnegative(),
    unitsOnHand: z.number().int(),
    unitsReserved: z.number().int().nonnegative(),
    unitsAvailable: z.number().int(),
    lowStockVariants: z.number().int().nonnegative(),
    outOfStockVariants: z.number().int().nonnegative(),
    inventoryValueByCurrency: z.array(
      z.object({ currency: commerceCurrencySchema, amountMinor: z.number().int().nonnegative() }),
    ),
    suggestedRestockByCurrency: z.array(
      z.object({ currency: commerceCurrencySchema, amountMinor: z.number().int().nonnegative() }),
    ),
  }),
  items: z.array(inventoryStockItemSchema),
  movements: z.array(inventoryMovementSchema),
  returns: z.array(returnCaseSchema),
});
export type InventorySnapshot = z.infer<typeof inventorySnapshotSchema>;

export const recordStockReceiptSchema = z.object({
  supplierId: z.string().optional(),
  reference: z.string().min(2).max(120),
  receivedAt: z.string().datetime(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitCost: moneySchema.optional(),
      }),
    )
    .min(1),
});
export type RecordStockReceipt = z.infer<typeof recordStockReceiptSchema>;

export const adjustStockSchema = z.object({
  variantId: z.string().min(1),
  countedOnHand: z.number().int().nonnegative(),
  reason: z.string().min(5).max(300),
});
export type AdjustStock = z.infer<typeof adjustStockSchema>;

export const createReturnCaseSchema = z.object({
  orderId: z.string().min(1),
  type: z.enum(['RETURN', 'EXCHANGE']),
  reason: returnReasonSchema,
  note: z.string().max(500).default(''),
  items: z
    .array(
      z.object({
        orderLineId: z.string().min(1),
        quantity: z.number().int().positive(),
        replacementVariantId: z.string().optional(),
      }),
    )
    .min(1),
});
export type CreateReturnCase = z.infer<typeof createReturnCaseSchema>;

export const receiveReturnCaseSchema = z.object({
  items: z
    .array(
      z.object({
        orderLineId: z.string().min(1),
        condition: returnConditionSchema,
        disposition: returnDispositionSchema,
      }),
    )
    .min(1),
  note: z.string().max(500).default(''),
});
export type ReceiveReturnCase = z.infer<typeof receiveReturnCaseSchema>;

export const resolveReturnCaseSchema = z.object({
  refundAmountMinor: z.number().int().nonnegative().default(0),
  refundMethod: paymentPreferenceSchema.optional(),
  refundReference: z.string().max(120).default(''),
});
export type ResolveReturnCase = z.infer<typeof resolveReturnCaseSchema>;
