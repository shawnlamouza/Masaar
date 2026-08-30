import { z } from 'zod';

export const adminTaskCategorySchema = z.enum([
  'REGISTRATION',
  'TAX',
  'NSSF',
  'LICENSE',
  'DOCUMENT',
  'CONTINUITY',
  'OTHER',
]);
export type AdminTaskCategory = z.infer<typeof adminTaskCategorySchema>;

export const adminTaskStatusSchema = z.enum(['OPEN', 'DUE_SOON', 'OVERDUE', 'DONE']);
export type AdminTaskStatus = z.infer<typeof adminTaskStatusSchema>;

export const adminTaskSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  title: z.string().min(3).max(140),
  category: adminTaskCategorySchema,
  status: adminTaskStatusSchema,
  dueDate: z.string().date().optional(),
  responsibleName: z.string().max(100).default(''),
  notes: z.string().max(600).default(''),
  reminderDays: z.number().int().min(0).max(90).default(7),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().min(1),
});
export type AdminTask = z.infer<typeof adminTaskSchema>;

export const createAdminTaskSchema = adminTaskSchema.omit({
  id: true,
  tenantId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: true,
});
export type CreateAdminTask = z.infer<typeof createAdminTaskSchema>;

export const updateAdminTaskSchema = createAdminTaskSchema.partial().extend({
  status: z.enum(['OPEN', 'DONE']).optional(),
});
export type UpdateAdminTask = z.infer<typeof updateAdminTaskSchema>;

export const integrationStatusSchema = z.enum([
  'CONNECTED',
  'SANDBOX',
  'READY_TO_CONFIGURE',
  'MANUAL_FALLBACK',
]);

export const integrationProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  category: z.enum(['IDENTITY', 'DATABASE', 'EMAIL', 'MESSAGING', 'DELIVERY', 'PAYMENTS']),
  status: integrationStatusSchema,
  officialOnly: z.literal(true),
  summary: z.string().min(3),
  fallback: z.string().min(3),
  nextStep: z.string().min(3),
});
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

export const launchCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  detail: z.string().min(3),
  complete: z.boolean(),
  target: z.enum([
    'Catalog',
    'Customers',
    'Orders',
    'Delivery',
    'Payments',
    'Business setup',
    'Launch Center',
  ]),
});
export type LaunchCheck = z.infer<typeof launchCheckSchema>;

export const customerSegmentSchema = z.object({
  id: z.enum(['CHAMPIONS', 'REPEAT', 'NEW', 'AT_RISK', 'RECOVERY_WATCH']),
  label: z.string().min(2),
  description: z.string().min(3),
  recommendedAction: z.string().min(3),
  customerIds: z.array(z.string().min(1)),
  customerNames: z.array(z.string().min(1)),
  count: z.number().int().nonnegative(),
  revenueUsdMinor: z.number().int().nonnegative(),
});
export type CustomerSegment = z.infer<typeof customerSegmentSchema>;

export const expansionSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  releaseLabel: z.literal('PHASE_9_RELEASE_CANDIDATE'),
  readinessPercent: z.number().int().min(0).max(100),
  checks: z.array(launchCheckSchema),
  integrations: z.array(integrationProviderSchema),
  adminTasks: z.array(adminTaskSchema),
  segments: z.array(customerSegmentSchema),
  guardrails: z.object({
    adminAdvice: z.literal('REMINDERS_NOT_LEGAL_ADVICE'),
    providers: z.literal('OFFICIAL_APIS_ONLY'),
    customerUse: z.literal('SEGMENTS_NOT_BLACKLISTS'),
    automation: z.literal('HUMAN_APPROVAL_REQUIRED'),
  }),
});
export type ExpansionSnapshot = z.infer<typeof expansionSnapshotSchema>;
