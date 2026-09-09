import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connectSqlServerRepositories } from './sqlserver-database.js';
import {
  seedPersistentDemoFoundation,
  seedPersistentDemoHistory,
} from './persistent-demo-history.js';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

async function main() {
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
  if (repositories && config.MAASAR_ENV === 'staging' && process.env.MAASAR_SEED_DEMO === 'true') {
    await seedPersistentDemoFoundation(repositories);
    await seedPersistentDemoHistory(repositories);
  }

  const publicRoot = resolve(process.cwd(), 'public');
  if (existsSync(publicRoot)) {
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'API route not found.' });
      }
      const pathname = decodeURIComponent(request.url.split('?')[0] ?? '/');
      const relativePath = normalize(pathname).replace(/^([/\\])+/, '');
      const candidate = resolve(join(publicRoot, relativePath));
      const requestedFile =
        candidate.startsWith(publicRoot) && existsSync(candidate) && statSync(candidate).isFile()
          ? candidate
          : join(publicRoot, 'index.html');
      const extension = extname(requestedFile).toLowerCase();
      const immutable = requestedFile.includes(`${join('assets', '')}`);
      reply
        .header('Content-Type', contentTypes[extension] ?? 'application/octet-stream')
        .header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
        .send(readFileSync(requestedFile));
    });
  }

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
