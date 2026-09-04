import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connectSqlServerRepositories } from './sqlserver-database.js';
import { seedPersistentDemoHistory } from './persistent-demo-history.js';

type LambdaProxy = (event: unknown, context: unknown) => Promise<unknown>;

let proxyPromise: Promise<LambdaProxy> | undefined;

function createProxy() {
  return (async () => {
    const config = loadConfig();
    const repositories = await connectSqlServerRepositories(config);
    const app = await buildApp({
      config,
      ...(repositories
        ? {
            auditRepository: repositories.auditRepository,
            settingsRepository: repositories.settingsRepository,
            commerceRepository: repositories.commerceRepository,
            orderRepository: repositories.orderRepository,
            fulfillmentRepository: repositories.fulfillmentRepository,
            notificationRepository: repositories.notificationRepository,
            inventoryRepository: repositories.inventoryRepository,
            expansionRepository: repositories.expansionRepository,
          }
        : {}),
    });
    await app.ready();
    return awsLambdaFastify(app) as LambdaProxy;
  })();
}

export async function handler(event: unknown, context: unknown) {
  if (
    event && typeof event === 'object' && 'maintenanceAction' in event &&
    event.maintenanceAction === 'SEED_PERSISTENT_DEMO_HISTORY'
  ) {
    const config = loadConfig();
    if (config.MAASAR_ENV !== 'staging') throw new Error('Demo history seeding is staging-only.');
    const repositories = await connectSqlServerRepositories(config);
    if (!repositories) throw new Error('SQL Server is required for persistent demo history.');
    return seedPersistentDemoHistory(repositories);
  }
  proxyPromise ??= createProxy();
  const proxy = await proxyPromise;
  return proxy(event, context);
}
