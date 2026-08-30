import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig({
  AUTH_MODE: 'dev',
  MAASAR_ENV: 'test',
  WEB_ORIGIN: 'http://localhost:5173',
});
const ownerHeaders = {
  authorization: 'Bearer dev.owner',
  'x-tenant-id': 'tenant_cedar_thread',
};

describe('Phase 9 governed expansion', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('reports launch truth, local reminders, integrations and transparent segments', async () => {
    const app = await buildApp({ config });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/expansion/snapshot',
      headers: ownerHeaders,
    });
    expect(response.statusCode).toBe(200);
    const snapshot = response.json();
    expect(snapshot.releaseLabel).toBe('PHASE_9_RELEASE_CANDIDATE');
    expect(snapshot.readinessPercent).toBeGreaterThan(50);
    expect(snapshot.checks.find((item: { id: string }) => item.id === 'production-identity')).toMatchObject({ complete: false });
    expect(snapshot.integrations.find((item: { id: string }) => item.id === 'whatsapp-business')).toMatchObject({ status: 'MANUAL_FALLBACK', officialOnly: true });
    expect(snapshot.adminTasks.length).toBeGreaterThan(0);
    expect(snapshot.segments.find((item: { id: string }) => item.id === 'CHAMPIONS').customerNames).toContain('Jana Khoury');
    expect(snapshot.guardrails.customerUse).toBe('SEGMENTS_NOT_BLACKLISTS');
  });

  it('audits owner reminders and denies employees the owner launch surface', async () => {
    const app = await buildApp({ config });
    apps.push(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/expansion/admin-tasks',
      headers: ownerHeaders,
      payload: {
        title: 'Verify municipal permit renewal date',
        category: 'LICENSE',
        dueDate: '2026-10-01',
        responsibleName: 'Joe',
        notes: 'Confirm the date with the municipality or retained adviser.',
        reminderDays: 14,
      },
    });
    expect(created.statusCode).toBe(201);
    const completed = await app.inject({
      method: 'PATCH',
      url: `/api/expansion/admin-tasks/${created.json().id}`,
      headers: ownerHeaders,
      payload: { status: 'DONE' },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().status).toBe('DONE');
    const audit = await app.inject({ method: 'GET', url: '/api/audit', headers: ownerHeaders });
    expect(audit.json().map((item: { action: string }) => item.action)).toContain('admin.reminder_completed');

    const employee = await app.inject({
      method: 'GET',
      url: '/api/expansion/snapshot',
      headers: {
        authorization: 'Bearer dev.employee',
        'x-tenant-id': 'tenant_cedar_thread',
      },
    });
    expect(employee.statusCode).toBe(403);
  });
});
