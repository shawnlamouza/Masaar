import { z } from 'zod';
export * from './commerce.js';
export * from './orders.js';
export * from './fulfillment.js';
export * from './workspace.js';
export * from './inventory.js';
export * from './intelligence.js';
export * from './predictive.js';
export * from './expansion.js';

export const roleSchema = z.enum(['OWNER', 'MANAGER', 'EMPLOYEE', 'DRIVER', 'READ_ONLY']);
export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
  'business:manage',
  'users:manage',
  'orders:read',
  'orders:write',
  'delivery:read',
  'delivery:write',
  'payments:read',
  'payments:write',
  'reconciliation:approve',
  'inventory:read',
  'inventory:write',
  'analytics:read',
  'audit:read',
  'catalog:read',
  'catalog:write',
  'customers:read',
  'customers:write',
  'suppliers:read',
  'suppliers:write',
  'pricing:read',
  'pricing:manage',
]);
export type Permission = z.infer<typeof permissionSchema>;

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  OWNER: permissionSchema.options,
  MANAGER: permissionSchema.options.filter((permission) => permission !== 'business:manage'),
  EMPLOYEE: [
    'orders:read',
    'orders:write',
    'delivery:read',
    'delivery:write',
    'payments:read',
    'payments:write',
    'inventory:read',
    'inventory:write',
    'catalog:read',
    'customers:read',
    'customers:write',
    'suppliers:read',
    'pricing:read',
  ],
  DRIVER: ['delivery:read', 'delivery:write'],
  READ_ONLY: [
    'orders:read',
    'delivery:read',
    'payments:read',
    'inventory:read',
    'analytics:read',
    'audit:read',
    'catalog:read',
    'customers:read',
    'suppliers:read',
    'pricing:read',
  ],
};

export const sessionSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  displayName: z.string().min(1),
  role: roleSchema,
  permissions: z.array(permissionSchema),
  authMode: z.enum(['dev', 'cognito']),
  onboardingRequired: z.boolean().default(false),
});
export type Session = z.infer<typeof sessionSchema>;

export const signInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const signInResponseSchema = z.object({
  accessToken: z.string().min(1),
  session: sessionSchema,
});
export type SignInResponse = z.infer<typeof signInResponseSchema>;

export const auditEventSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: roleSchema,
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().min(1),
  reason: z.string().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('masaar-api'),
  environment: z.string(),
  timestamp: z.string().datetime(),
});

export const actionCardSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'warning', 'opportunity']),
  title: z.string(),
  explanation: z.string(),
  impact: z.string(),
  action: z.string(),
});
export type ActionCard = z.infer<typeof actionCardSchema>;

export const currencySchema = z.enum(['USD', 'LBP']);
export type Currency = z.infer<typeof currencySchema>;

export const businessSettingsSchema = z.object({
  tenantId: z.string().min(1),
  businessName: z.string().min(2).max(120),
  baseCurrency: currencySchema,
  enabledCurrencies: z.array(currencySchema).min(1),
  timezone: z.literal('Asia/Beirut'),
  lowConnectivityMode: z.boolean(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().min(1),
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export const updateBusinessSettingsSchema = businessSettingsSchema.pick({
  businessName: true,
  baseCurrency: true,
  enabledCurrencies: true,
  lowConnectivityMode: true,
});
export type UpdateBusinessSettings = z.infer<typeof updateBusinessSettingsSchema>;
