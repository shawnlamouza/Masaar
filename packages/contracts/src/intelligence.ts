import { z } from 'zod';
import { commerceCurrencySchema } from './commerce.js';
import { orderSourceSchema } from './orders.js';

export const intelligencePeriodSchema = z.enum(['7D', '30D', '90D']);
export type IntelligencePeriod = z.infer<typeof intelligencePeriodSchema>;

export const intelligenceMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  previousValue: z.number(),
  changePercent: z.number().nullable(),
  unit: z.enum(['MONEY_MINOR', 'PERCENT', 'COUNT', 'DAYS']),
  currency: commerceCurrencySchema.optional(),
  direction: z.enum(['UP_IS_GOOD', 'DOWN_IS_GOOD', 'NEUTRAL']),
  definition: z.string().min(1),
  sourceCount: z.number().int().nonnegative(),
  completeness: z.number().min(0).max(100),
});

export const intelligenceTrendPointSchema = z.object({
  date: z.string(),
  revenueMinor: z.number().int().nonnegative(),
  grossProfitMinor: z.number().int(),
  collectedMinor: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
});

export const channelPerformanceSchema = z.object({
  channel: orderSourceSchema,
  revenueMinor: z.number().int().nonnegative(),
  grossProfitMinor: z.number().int(),
  orders: z.number().int().nonnegative(),
  averageOrderMinor: z.number().int().nonnegative(),
  sharePercent: z.number().min(0),
});

export const productPerformanceSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  units: z.number().int().nonnegative(),
  revenueMinor: z.number().int().nonnegative(),
  grossProfitMinor: z.number().int(),
  marginPercent: z.number(),
  availableUnits: z.number().int(),
  stockCoverDays: z.number().nullable(),
  signal: z.enum(['WINNER', 'WATCH', 'RESTOCK', 'SLOW']),
});

export const areaPerformanceSchema = z.object({
  area: z.string().min(1),
  governorate: z.string().min(1),
  orders: z.number().int().nonnegative(),
  revenueMinor: z.number().int().nonnegative(),
  deliverySuccessPercent: z.number().min(0).max(100),
  failedDeliveries: z.number().int().nonnegative(),
  averageOrderMinor: z.number().int().nonnegative(),
});

export const failureMixSchema = z.object({
  reason: z.string().min(1),
  count: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
});

export const intelligenceInsightSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['CRITICAL', 'WARNING', 'OPPORTUNITY', 'INFO']),
  title: z.string().min(1),
  explanation: z.string().min(1),
  impact: z.string().min(1),
  recommendation: z.string().min(1),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  target: z.enum([
    'Orders',
    'Customers',
    'Price Studio',
    'Delivery',
    'Payments',
    'Stock Control',
    'Returns',
  ]),
});

export const intelligenceSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  period: intelligencePeriodSchema,
  periodLabel: z.string().min(1),
  dataMode: z.enum(['LIVE', 'DEMO_WITH_HISTORY']),
  currency: commerceCurrencySchema,
  metrics: z.array(intelligenceMetricSchema),
  trend: z.array(intelligenceTrendPointSchema),
  channels: z.array(channelPerformanceSchema),
  products: z.array(productPerformanceSchema),
  areas: z.array(areaPerformanceSchema),
  failureMix: z.array(failureMixSchema),
  cash: z.object({
    recognizedRevenueMinor: z.number().int().nonnegative(),
    collectedMinor: z.number().int().nonnegative(),
    outstandingMinor: z.number().int().nonnegative(),
    cashHeldMinor: z.number().int().nonnegative(),
    inventoryValueMinor: z.number().int().nonnegative(),
    suggestedRestockMinor: z.number().int().nonnegative(),
    refundsMinor: z.number().int().nonnegative(),
  }),
  customers: z.object({
    activeCustomers: z.number().int().nonnegative(),
    repeatCustomers: z.number().int().nonnegative(),
    repeatRatePercent: z.number().min(0).max(100),
    estimatedLifetimeValueMinor: z.number().int().nonnegative(),
  }),
  delivery: z.object({
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    successPercent: z.number().min(0).max(100),
    firstAttemptSuccessPercent: z.number().min(0).max(100),
    knownCostMinor: z.number().int().nonnegative(),
  }),
  insights: z.array(intelligenceInsightSchema),
  methodology: z.array(z.string().min(1)),
});

export type IntelligenceSnapshot = z.infer<typeof intelligenceSnapshotSchema>;
