import { z } from 'zod';
const workspaceRoleSchema = z.enum(['OWNER', 'MANAGER', 'EMPLOYEE', 'DRIVER', 'READ_ONLY']);

export const registerBusinessSchema = z.object({
  businessName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});
export type RegisterBusiness = z.infer<typeof registerBusinessSchema>;

export const teamMemberSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  displayName: z.string().min(2),
  email: z.string().email(),
  role: workspaceRoleSchema,
  status: z.enum(['ACTIVE', 'INVITED', 'DISABLED']),
  createdAt: z.string().datetime(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const inviteTeamMemberSchema = z.object({
  displayName: z.string().min(2).max(120),
  email: z.string().email(),
  role: workspaceRoleSchema.exclude(['OWNER']),
  phone: z.string().min(5).max(30).optional(),
});
export type InviteTeamMember = z.infer<typeof inviteTeamMemberSchema>;

export const teamInvitationResponseSchema = z.object({
  member: teamMemberSchema,
  temporaryPassword: z.string().min(8).optional(),
});

export const notificationSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['critical', 'warning', 'info', 'success']),
  title: z.string().min(2),
  detail: z.string().min(2),
  target: z.enum([
    'Overview',
    'Orders',
    'Catalog',
    'Customers',
    'Delivery',
    'Payments',
    'Stock Control',
    'Returns',
    'Business setup',
  ]),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;
