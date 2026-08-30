import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connectSqlServerRepositories } from './sqlserver-database.js';

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

if (repositories) app.addHook('onClose', async () => repositories.pool.close());

await app.listen({ port: config.PORT, host: config.HOST });
