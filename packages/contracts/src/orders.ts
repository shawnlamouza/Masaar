import { z } from 'zod';
import {
  addressSchema,
  commerceCurrencySchema,
  lebanesePhoneSchema,
  moneySchema,
  paymentPreferenceSchema,
} from './commerce.js';

export const orderStatusSchema = z.enum([
  'PENDING_CUSTOMER_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'PACKED',
  'READY_FOR_DISPATCH',
  'ASSIGNED_TO_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'RETURNED',
  'REFUNDED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSourceSchema = z.enum([
  'INSTAGRAM',
  'WHATSAPP',
  'FACEBOOK',
  'TIKTOK',
  'WEBSITE',
  'PHONE',
  'STORE',
  'ORDER_LINK',
]);
export type OrderSource = z.infer<typeof orderSourceSchema>;

export const orderLineSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  productName: z.string().min(1),
  sku: z.string().min(1),
  variantLabel: z.string(),
  quantity: z.number().int().positive().max(500),
  unitPrice: moneySchema,
  unitCost: moneySchema,
  lineTotal: moneySchema,
});

export const orderTotalsSchema = z.object({
  itemsSubtotal: moneySchema,
  discount: moneySchema,
  deliveryFee: moneySchema,
  grandTotal: moneySchema,
  prepaid: moneySchema,
  amountDue: moneySchema,
});

export const orderTimelineEventSchema = z.object({
  id: z.string().min(1),
  actorType: z.enum(['USER', 'CUSTOMER', 'SYSTEM']),
  actorId: z.string().min(1),
  actorName: z.string().min(1),
  action: z.string().min(1),
  message: z.string().min(1),
  fromStatus: orderStatusSchema.optional(),
  toStatus: orderStatusSchema.optional(),
  occurredAt: z.string().datetime(),
});

export const orderNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const messageHistorySchema = z.object({
  id: z.string().min(1),
  template: z.enum(['CONFIRMATION', 'REMINDER', 'STATUS']),
  channel: z.literal('WHATSAPP'),
  text: z.string().min(1),
  copiedBy: z.string().min(1),
  copiedAt: z.string().datetime(),
});

export const orderSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  orderNumber: z.string().min(1),
  source: orderSourceSchema,
  status: orderStatusSchema,
  customerId: z.string().optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: lebanesePhoneSchema,
  deliveryAddress: addressSchema.optional(),
  deliveryNotes: z.string().max(500).default(''),
  deliveryZoneId: z.string().optional(),
  items: z.array(orderLineSchema).min(1),
  currency: commerceCurrencySchema,
  totals: orderTotalsSchema,
  paymentMethod: paymentPreferenceSchema,
  tags: z.array(z.string().min(1).max(40)).max(12),
  notes: z.array(orderNoteSchema),
  timeline: z.array(orderTimelineEventSchema),
  messages: z.array(messageHistorySchema),
  confirmationExpiresAt: z.string().datetime(),
  confirmedAt: z.string().datetime().optional(),
  assignedUserId: z.string().optional(),
  duplicateOverrideReason: z.string().max(240).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().min(1),
});
export type Order = z.infer<typeof orderSchema>;

export const quickOrderSchema = z.object({
  source: orderSourceSchema,
  customerId: z.string().optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().min(5).max(30),
  items: z
    .array(
      z.object({ variantId: z.string().min(1), quantity: z.number().int().positive().max(500) }),
    )
    .min(1),
  discountType: z.enum(['FIXED', 'PERCENT']).default('FIXED'),
  discountValue: z.number().int().nonnegative(),
  deliveryFeeMinor: z.number().int().nonnegative(),
  deliveryZoneId: z.string().optional(),
  prepaidMinor: z.number().int().nonnegative(),
  paymentMethod: paymentPreferenceSchema,
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  note: z.string().max(500).default(''),
  duplicateOverrideReason: z.string().min(3).max(240).optional(),
});
export type QuickOrder = z.infer<typeof quickOrderSchema>;

export const quickOrderResponseSchema = z.object({
  order: orderSchema,
  confirmationToken: z.string().min(20),
  confirmationUrl: z.string().url(),
});
export type QuickOrderResponse = z.infer<typeof quickOrderResponseSchema>;

export const customerConfirmationSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(5).max(30),
  governorate: addressSchema.shape.governorate,
  area: z.string().min(1).max(80),
  locality: z.string().min(1).max(100),
  street: z.string().max(120).default(''),
  building: z.string().max(100).default(''),
  floor: z.string().max(30).default(''),
  landmark: z.string().max(180).default(''),
  mapUrl: z.union([z.literal(''), z.string().url()]).optional(),
  deliveryNotes: z.string().max(500).default(''),
});
export type CustomerConfirmation = z.infer<typeof customerConfirmationSchema>;

export const transitionOrderSchema = z.object({
  status: orderStatusSchema,
  reason: z.string().max(240).default(''),
});

export const bulkTransitionSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(50),
  status: orderStatusSchema,
  reason: z.string().max(240).default('Bulk workflow action'),
});

export const addOrderNoteSchema = z.object({ text: z.string().min(1).max(500) });
export const updateOrderTagsSchema = z.object({ tags: z.array(z.string().min(1).max(40)).max(12) });
export const messageTemplateRequestSchema = z.object({
  template: z.enum(['CONFIRMATION', 'REMINDER', 'STATUS']),
});

export const publicOrderSchema = orderSchema
  .pick({
    orderNumber: true,
    customerName: true,
    customerPhone: true,
    status: true,
    items: true,
    totals: true,
    paymentMethod: true,
    confirmationExpiresAt: true,
    confirmedAt: true,
  })
  .extend({ businessName: z.string() });
export type PublicOrder = z.infer<typeof publicOrderSchema>;

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_CUSTOMER_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['PACKED', 'CANCELLED'],
  PACKED: ['READY_FOR_DISPATCH', 'CANCELLED'],
  READY_FOR_DISPATCH: ['ASSIGNED_TO_DELIVERY', 'CANCELLED'],
  ASSIGNED_TO_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: ['RETURNED', 'REFUNDED'],
  FAILED: ['ASSIGNED_TO_DELIVERY', 'CANCELLED', 'RETURNED'],
  CANCELLED: [],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};
