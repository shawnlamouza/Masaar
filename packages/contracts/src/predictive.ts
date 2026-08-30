import { z } from 'zod';
import { intelligencePeriodSchema } from './intelligence.js';

const intelligenceTargetSchema = z.enum([
  'Orders',
  'Customers',
  'Price Studio',
  'Delivery',
  'Payments',
  'Stock Control',
  'Returns',
  'Intelligence',
  'Forecast & AI',
]);

export const forecastPointSchema = z.object({
  date: z.string(),
  expectedRevenueMinor: z.number().int().nonnegative(),
  lowRevenueMinor: z.number().int().nonnegative(),
  highRevenueMinor: z.number().int().nonnegative(),
  expectedOrders: z.number().nonnegative(),
});

export const anomalySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['REVENUE', 'MARGIN', 'DELIVERY', 'PAYMENT', 'INVENTORY']),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  title: z.string().min(1),
  observed: z.string().min(1),
  expected: z.string().min(1),
  deviationPercent: z.number(),
  explanation: z.string().min(1),
  target: intelligenceTargetSchema,
});

export const restockPredictionSchema = z.object({
  variantId: z.string().min(1),
  sku: z.string().min(1),
  productName: z.string().min(1),
  availableUnits: z.number().int(),
  forecastDemand14Days: z.number().int().nonnegative(),
  safetyUnits: z.number().int().nonnegative(),
  recommendedUnits: z.number().int().nonnegative(),
  estimatedCashMinor: z.number().int().nonnegative(),
  estimatedStockoutDate: z.string().nullable(),
  supplierLeadTimeDays: z.number().int().nonnegative().nullable(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  explanation: z.string().min(1),
});

export const deliveryRiskSchema = z.object({
  area: z.string().min(1),
  governorate: z.string().min(1),
  riskScore: z.number().min(0).max(100),
  band: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  predictedFailurePercent: z.number().min(0).max(100),
  sampleSize: z.number().int().nonnegative(),
  factors: z.array(z.string().min(1)),
  recommendation: z.string().min(1),
});

export const customerReliabilitySchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  indicator: z.enum(['NORMAL', 'CAUTION', 'EXTRA_CONFIRMATION']),
  evidenceScore: z.number().min(0).max(100),
  completedOrders: z.number().int().nonnegative(),
  cancelledOrders: z.number().int().nonnegative(),
  failedDeliveries: z.number().int().nonnegative(),
  explanation: z.string().min(1),
  recommendation: z.string().min(1),
});

export const predictiveSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  period: intelligencePeriodSchema,
  dataMode: z.enum(['LIVE', 'DEMO_WITH_HISTORY']),
  forecast: z.object({
    horizonDays: z.literal(14),
    expectedRevenueMinor: z.number().int().nonnegative(),
    lowRevenueMinor: z.number().int().nonnegative(),
    highRevenueMinor: z.number().int().nonnegative(),
    expectedOrders: z.number().nonnegative(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    historyDays: z.number().int().nonnegative(),
    method: z.string().min(1),
    points: z.array(forecastPointSchema),
  }),
  anomalies: z.array(anomalySchema),
  restock: z.array(restockPredictionSchema),
  deliveryRisks: z.array(deliveryRiskSchema),
  customerReliability: z.array(customerReliabilitySchema),
  scenarioDefaults: z.object({
    averageOrderMinor: z.number().int().nonnegative(),
    grossMarginPercent: z.number().min(0).max(100),
    monthlyFixedCostsMinor: z.number().int().nonnegative(),
    monthlyMarketingMinor: z.number().int().nonnegative(),
  }),
  governance: z.object({
    forecastReady: z.boolean(),
    anomalyReady: z.boolean(),
    customerPredictionReady: z.boolean(),
    assistantMode: z.literal('GROUNDED_RULE_ENGINE'),
    limitations: z.array(z.string().min(1)),
  }),
  suggestedQuestions: z.array(z.string().min(1)),
});
export type PredictiveSnapshot = z.infer<typeof predictiveSnapshotSchema>;

export const assistantRequestSchema = z.object({
  question: z.string().min(3).max(500),
  period: intelligencePeriodSchema.default('30D'),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const assistantResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  mode: z.literal('GROUNDED_RULE_ENGINE'),
  question: z.string().min(1),
  answer: z.string().min(1),
  facts: z.array(z.string().min(1)),
  actions: z.array(z.object({ label: z.string().min(1), target: intelligenceTargetSchema })),
  caveat: z.string().min(1),
});
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
