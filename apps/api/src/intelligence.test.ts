import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { provisionDevMember } from './auth.js';

const config = loadConfig({
  AUTH_MODE: 'dev',
  MAASAR_ENV: 'test',
  WEB_ORIGIN: 'http://localhost:5173',
});

describe('Phase 7 explainable intelligence', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('returns separated revenue, collection, margin and decision evidence for an owner', async () => {
    const app = await buildApp({ config });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/intelligence/snapshot?period=30D',
      headers: { authorization: 'Bearer dev.owner', 'x-tenant-id': 'tenant_cedar_thread' },
    });
    expect(response.statusCode).toBe(200);
    const snapshot = response.json();
    expect(snapshot).toMatchObject({
      period: '30D',
      dataMode: 'LIVE',
      currency: 'USD',
    });
    expect(snapshot.trend.length).toBeGreaterThan(5);
    expect(snapshot.channels.length).toBeGreaterThan(1);
    expect(snapshot.insights[0]).toMatchObject({ target: 'Payments', confidence: 'HIGH' });
    expect(snapshot.cash.recognizedRevenueMinor).toBeGreaterThanOrEqual(snapshot.cash.collectedMinor);
    expect(snapshot.methodology.join(' ')).toContain('Recognized revenue');
    expect(snapshot.methodology.join(' ')).toContain('owner-approved reference of 89,500 LBP/USD');
  });

  it('protects owner intelligence from employee access and gives analysts read access', async () => {
    const app = await buildApp({ config });
    apps.push(app);
    const employee = await app.inject({
      method: 'GET',
      url: '/api/intelligence/snapshot?period=7D',
      headers: { authorization: 'Bearer dev.employee', 'x-tenant-id': 'tenant_cedar_thread' },
    });
    const analystIdentity = provisionDevMember({
      tenantId: 'tenant_cedar_thread',
      displayName: 'Test Analyst',
      email: `analyst-${Date.now()}@example.test`,
      role: 'READ_ONLY',
      password: 'test-only-password',
    });
    const analyst = await app.inject({
      method: 'GET',
      url: '/api/intelligence/snapshot?period=7D',
      headers: {
        authorization: `Bearer ${analystIdentity.token}`,
        'x-tenant-id': 'tenant_cedar_thread',
      },
    });
    expect(employee.statusCode).toBe(403);
    expect(analyst.statusCode).toBe(200);
  });
});
