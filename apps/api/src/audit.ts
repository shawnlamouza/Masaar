import { randomUUID } from 'node:crypto';
import { auditEventSchema, type AuditEvent, type Session } from '@masaar/contracts';

export interface AuditRepository {
  append(event: AuditEvent): Promise<void>;
  listForTenant(tenantId: string): Promise<AuditEvent[]>;
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent) {
    this.events.push(auditEventSchema.parse(event));
  }

  async listForTenant(tenantId: string) {
    return this.events.filter((event) => event.tenantId === tenantId);
  }
}

export async function recordAudit(
  repository: AuditRepository,
  input: {
    session: Session;
    action: string;
    entityType: string;
    entityId: string;
    correlationId: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  const event = auditEventSchema.parse({
    id: randomUUID(),
    tenantId: input.session.tenantId,
    actorId: input.session.userId,
    actorRole: input.session.role,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
  });
  await repository.append(event);
  return event;
}
