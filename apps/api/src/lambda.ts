import awsLambdaFastify from '@fastify/aws-lambda';
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
await app.ready();

export const handler = awsLambdaFastify(app);
