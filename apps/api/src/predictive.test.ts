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

describe('Phase 8 governed predictive intelligence', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('builds a bounded forecast and explainable recommendations without autonomous actions', async () => {
    const app = await buildApp({ config });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/predictive/snapshot?period=30D',
      headers: ownerHeaders,
    });
    expect(response.statusCode).toBe(200);
    const snapshot = response.json();
    expect(snapshot.forecast).toMatchObject({ horizonDays: 14, historyDays: 30 });
    expect(snapshot.forecast.points).toHaveLength(14);
    expect(snapshot.forecast.lowRevenueMinor).toBeLessThan(snapshot.forecast.expectedRevenueMinor);
    expect(snapshot.forecast.highRevenueMinor).toBeGreaterThan(
      snapshot.forecast.expectedRevenueMinor,
    );
    expect(snapshot.anomalies.some((item: { kind: string }) => item.kind === 'PAYMENT')).toBe(true);
    expect(snapshot.governance).toMatchObject({
      assistantMode: 'GROUNDED_RULE_ENGINE',
      forecastReady: true,
    });
    expect(snapshot.governance.limitations.join(' ')).toContain('never a blacklist');
  });

  it('answers from business evidence and keeps employee access blocked', async () => {
    const app = await buildApp({ config });
    apps.push(app);
    const answer = await app.inject({
      method: 'POST',
      url: '/api/predictive/assistant',
      headers: ownerHeaders,
      payload: { question: 'Which products should I restock?', period: '30D' },
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toMatchObject({
      mode: 'GROUNDED_RULE_ENGINE',
      actions: [{ target: 'Stock Control' }],
    });
    expect(answer.json().facts.length).toBeGreaterThan(0);
    const employee = await app.inject({
      method: 'GET',
      url: '/api/predictive/snapshot',
      headers: {
        authorization: 'Bearer dev.employee',
        'x-tenant-id': 'tenant_cedar_thread',
      },
    });
    expect(employee.statusCode).toBe(403);
  });
});
