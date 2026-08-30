import {
  adminTaskSchema,
  type AdminTask,
  type AdminTaskStatus,
} from '@masaar/contracts';

export interface ExpansionRepository {
  listAdminTasks(tenantId: string): Promise<AdminTask[]>;
  getAdminTask(tenantId: string, id: string): Promise<AdminTask | null>;
  saveAdminTask(task: AdminTask): Promise<void>;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function effectiveAdminStatus(task: AdminTask, now = new Date()): AdminTaskStatus {
  if (task.status === 'DONE') return 'DONE';
  if (!task.dueDate) return 'OPEN';
  const due = new Date(`${task.dueDate}T23:59:59.999Z`).getTime();
  if (due < now.getTime()) return 'OVERDUE';
  const warning = now.getTime() + task.reminderDays * 86_400_000;
  return due <= warning ? 'DUE_SOON' : 'OPEN';
}

export function defaultAdminTasks(tenantId: string): AdminTask[] {
  const now = new Date();
  const timestamp = now.toISOString();
  return [
    {
      id: 'admin_tax_calendar',
      tenantId,
      title: 'Verify the next Ministry of Finance deadline',
      category: 'TAX',
      status: 'OPEN',
      dueDate: addDays(now, 14),
      responsibleName: 'Owner / accountant',
      notes:
        'Confirm the applicable date with the business accountant or official source. Masaar stores the reminder; it does not provide tax advice or file returns.',
      reminderDays: 7,
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: 'system',
    },
    {
      id: 'admin_nssf_check',
      tenantId,
      title: 'Review employee and NSSF records',
      category: 'NSSF',
      status: 'OPEN',
      dueDate: addDays(now, 21),
      responsibleName: 'Owner / accountant',
      notes:
        'Check that employee records, receipts and any required follow-up are stored together.',
      reminderDays: 7,
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: 'system',
    },
    {
      id: 'admin_continuity_pack',
      tenantId,
      title: 'Refresh the offline continuity pack',
      category: 'CONTINUITY',
      status: 'OPEN',
      dueDate: addDays(now, 30),
      responsibleName: 'Operations owner',
      notes:
        'Export essential contacts, open deliveries and cash responsibilities for use during a prolonged connectivity interruption.',
      reminderDays: 5,
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: 'system',
    },
  ].map((task) => adminTaskSchema.parse(task));
}

export class InMemoryExpansionRepository implements ExpansionRepository {
  private readonly tasks = new Map<string, AdminTask[]>();

  private data(tenantId: string) {
    const existing = this.tasks.get(tenantId);
    if (existing) return existing;
    const seeded = defaultAdminTasks(tenantId);
    this.tasks.set(tenantId, seeded);
    return seeded;
  }

  async listAdminTasks(tenantId: string) {
    return structuredClone(
      this.data(tenantId).map((task) => ({ ...task, status: effectiveAdminStatus(task) })),
    );
  }

  async getAdminTask(tenantId: string, id: string) {
    const task = this.data(tenantId).find((candidate) => candidate.id === id);
    return task ? structuredClone({ ...task, status: effectiveAdminStatus(task) }) : null;
  }

  async saveAdminTask(task: AdminTask) {
    const parsed = adminTaskSchema.parse(structuredClone(task));
    const tasks = this.data(parsed.tenantId);
    const index = tasks.findIndex((candidate) => candidate.id === parsed.id);
    if (index === -1) tasks.push(parsed);
    else tasks[index] = parsed;
  }
}
