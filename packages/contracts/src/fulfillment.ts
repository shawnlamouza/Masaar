import { z } from 'zod';
import { commerceCurrencySchema, moneySchema, paymentPreferenceSchema } from './commerce.js';

export const deliveryResourceTypeSchema = z.enum(['INTERNAL_DRIVER', 'FREELANCER', 'COMPANY']);
export type DeliveryResourceType = z.infer<typeof deliveryResourceTypeSchema>;
export const deliveryResourceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(2),
  type: deliveryResourceTypeSchema,
  phone: z.string().min(5),
  active: z.boolean(),
  serviceAreas: z.array(z.string()),
  settlementTerms: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DeliveryResource = z.infer<typeof deliveryResourceSchema>;

export const createDeliveryResourceSchema = deliveryResourceSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateDeliveryResource = z.infer<typeof createDeliveryResourceSchema>;
export const updateDeliveryResourceSchema = createDeliveryResourceSchema;
export type UpdateDeliveryResource = z.infer<typeof updateDeliveryResourceSchema>;

export const deliveryZoneSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(2),
  governorates: z.array(z.string()).min(1),
  areas: z.array(z.string()),
  customerFee: moneySchema,
  businessCost: moneySchema,
  estimatedDays: z.number().int().positive(),
  active: z.boolean(),
});
export type DeliveryZone = z.infer<typeof deliveryZoneSchema>;

export const createDeliveryZoneSchema = deliveryZoneSchema
  .omit({
    id: true,
    tenantId: true,
  })
  .superRefine((value, context) => {
    if (value.customerFee.currency !== value.businessCost.currency)
      context.addIssue({
        code: 'custom',
        path: ['businessCost', 'currency'],
        message: 'Customer fee and courier cost must use the same currency.',
      });
  });
export type CreateDeliveryZone = z.infer<typeof createDeliveryZoneSchema>;
export const updateDeliveryZoneSchema = createDeliveryZoneSchema;
export type UpdateDeliveryZone = z.infer<typeof updateDeliveryZoneSchema>;

export const deliveryFailureReasonSchema = z.enum([
  'UNREACHABLE',
  'CUSTOMER_UNAVAILABLE',
  'CUSTOMER_REFUSED',
  'INCORRECT_ADDRESS',
  'ACCESS_OR_WEATHER',
  'DAMAGED_PARCEL',
  'DRIVER_OR_COURIER_ISSUE',
  'OTHER',
]);
export type DeliveryFailureReason = z.infer<typeof deliveryFailureReasonSchema>;

export const deliveryAttemptSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  status: z.enum(['SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']),
  scheduledAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  failureReason: deliveryFailureReasonSchema.optional(),
  note: z.string().max(500).default(''),
  commandId: z.string().optional(),
  actorId: z.string().min(1),
});
export type DeliveryAttempt = z.infer<typeof deliveryAttemptSchema>;

export const deliveryAssignmentHistorySchema = z.object({
  id: z.string().min(1),
  resourceId: z.string().min(1),
  resourceName: z.string().min(1),
  assignedBy: z.string().min(1),
  assignedAt: z.string().datetime(),
  reason: z.string().max(240),
});

export const deliveryCaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  status: z.enum(['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']),
  resourceId: z.string().min(1),
  resourceName: z.string().min(1),
  resourceType: deliveryResourceTypeSchema,
  zoneId: z.string().min(1),
  zoneName: z.string().min(1),
  customerFee: moneySchema,
  businessCost: moneySchema,
  expectedCollection: moneySchema,
  attempts: z.array(deliveryAttemptSchema),
  assignmentHistory: z.array(deliveryAssignmentHistorySchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});
export type DeliveryCase = z.infer<typeof deliveryCaseSchema>;

export const assignDeliverySchema = z.object({
  orderId: z.string().min(1),
  resourceId: z.string().min(1),
  zoneId: z.string().min(1),
  reason: z.string().max(240).default('Dispatch assignment'),
});
export type AssignDelivery = z.infer<typeof assignDeliverySchema>;

export const paymentMethodSchema = paymentPreferenceSchema;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export const paymentEntrySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  deliveryId: z.string().optional(),
  type: z.enum(['COLLECTION', 'REFUND']),
  method: paymentMethodSchema,
  status: z.enum(['POSTED', 'FAILED']),
  amount: moneySchema,
  reference: z.string().max(120).default(''),
  proofUrl: z.string().url().optional(),
  holderId: z.string().optional(),
  holderName: z.string().optional(),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
});
export type PaymentEntry = z.infer<typeof paymentEntrySchema>;

export const paymentProjectionSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  currency: commerceCurrencySchema,
  payable: moneySchema,
  collected: moneySchema,
  refunded: moneySchema,
  balance: moneySchema,
  state: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED']),
  entries: z.array(paymentEntrySchema),
});
export type PaymentProjection = z.infer<typeof paymentProjectionSchema>;

export const recordPaymentSchema = z.object({
  orderId: z.string().min(1),
  deliveryId: z.string().optional(),
  type: z.enum(['COLLECTION', 'REFUND']).default('COLLECTION'),
  method: paymentMethodSchema,
  status: z.enum(['POSTED', 'FAILED']).default('POSTED'),
  amountMinor: z.number().int().positive(),
  currency: commerceCurrencySchema,
  reference: z.string().max(120).default(''),
  proofUrl: z.union([z.literal(''), z.string().url()]).optional(),
  holderId: z.string().optional(),
  holderName: z.string().optional(),
  occurredAt: z.string().datetime(),
});
export type RecordPayment = z.infer<typeof recordPaymentSchema>;

export const custodyMovementSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  paymentId: z.string().optional(),
  reconciliationId: z.string().optional(),
  type: z.enum([
    'CASH_COLLECTION',
    'DRIVER_COLLECTION',
    'HANDOVER_ACCEPTED',
    'DEPOSIT',
    'APPROVED_ADJUSTMENT',
    'REFUND_PAYOUT',
  ]),
  amount: moneySchema,
  fromHolderId: z.string().optional(),
  fromHolderName: z.string().optional(),
  toHolderId: z.string().optional(),
  toHolderName: z.string().optional(),
  occurredAt: z.string().datetime(),
  actorId: z.string().min(1),
  note: z.string().max(240).default(''),
});
export type CustodyMovement = z.infer<typeof custodyMovementSchema>;

export const cashPositionSchema = z.object({
  holderId: z.string().min(1),
  holderName: z.string().min(1),
  currency: commerceCurrencySchema,
  amount: moneySchema,
  oldestSince: z.string().datetime(),
  movementCount: z.number().int().nonnegative(),
});
export type CashPosition = z.infer<typeof cashPositionSchema>;

export const reconciliationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  holderId: z.string().min(1),
  holderName: z.string().min(1),
  currency: commerceCurrencySchema,
  status: z.enum(['DRAFT', 'SUBMITTED', 'MATCHED', 'DISCREPANCY_REVIEW', 'APPROVED', 'CLOSED']),
  expected: moneySchema,
  returned: moneySchema,
  remaining: moneySchema,
  variance: z.object({ amountMinor: z.number().int(), currency: commerceCurrencySchema }),
  explanation: z.string().max(500).default(''),
  evidenceUrl: z.string().url().optional(),
  paymentIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  approvedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(),
  closedAt: z.string().datetime().optional(),
});
export type Reconciliation = z.infer<typeof reconciliationSchema>;

export const createReconciliationSchema = z
  .object({
    holderId: z.string().min(1),
    holderName: z.string().min(1),
    currency: commerceCurrencySchema,
    returnedMinor: z.number().int().nonnegative(),
    explanation: z.string().max(500).default(''),
    evidenceUrl: z.union([z.literal(''), z.string().url()]).optional(),
  })
  .superRefine((value, context) => {
    if (value.returnedMinor < 0)
      context.addIssue({
        code: 'custom',
        path: ['returnedMinor'],
        message: 'Returned amount cannot be negative.',
      });
  });
export type CreateReconciliation = z.infer<typeof createReconciliationSchema>;

export const approveReconciliationSchema = z.object({ reason: z.string().min(3).max(500) });

export const driverCommandSchema = z
  .object({
    commandId: z.string().min(8).max(120),
    deliveryId: z.string().min(1),
    action: z.enum(['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']),
    occurredAt: z.string().datetime(),
    failureReason: deliveryFailureReasonSchema.optional(),
    note: z.string().max(500).default(''),
    payment: z
      .object({
        method: paymentMethodSchema,
        amountMinor: z.number().int().nonnegative(),
        currency: commerceCurrencySchema,
        reference: z.string().max(120).default(''),
        proofUrl: z.union([z.literal(''), z.string().url()]).optional(),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'FAILED' && !value.failureReason)
      context.addIssue({
        code: 'custom',
        path: ['failureReason'],
        message: 'A failed delivery reason is required.',
      });
  });
export type DriverCommand = z.infer<typeof driverCommandSchema>;

export const driverStopSchema = z.object({
  delivery: deliveryCaseSchema,
  customer: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    mapUrl: z.string().url().optional(),
    notes: z.string(),
  }),
  order: z.object({
    orderId: z.string(),
    orderNumber: z.string(),
    itemCount: z.number().int().positive(),
    amountToCollect: moneySchema,
    paymentState: paymentProjectionSchema.shape.state,
  }),
});
export type DriverStop = z.infer<typeof driverStopSchema>;

export const dailyCloseSchema = z.object({
  date: z.string(),
  deliveredOrders: z.number().int().nonnegative(),
  deliveredValue: z.array(moneySchema),
  collectionsByMethod: z.array(z.object({ method: paymentMethodSchema, amount: moneySchema })),
  cashPositions: z.array(cashPositionSchema),
  unresolvedPayments: z.number().int().nonnegative(),
  refunds: z.array(moneySchema),
  openDiscrepancies: z.number().int().nonnegative(),
});
export type DailyClose = z.infer<typeof dailyCloseSchema>;

export const fulfillmentSnapshotSchema = z.object({
  resources: z.array(deliveryResourceSchema),
  zones: z.array(deliveryZoneSchema),
  deliveries: z.array(deliveryCaseSchema),
  payments: z.array(paymentProjectionSchema),
  cashPositions: z.array(cashPositionSchema),
  reconciliations: z.array(reconciliationSchema),
  dailyClose: dailyCloseSchema,
});
export type FulfillmentSnapshot = z.infer<typeof fulfillmentSnapshotSchema>;
