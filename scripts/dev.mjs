import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const services = [
  {
    name: 'api',
    cwd: resolve(root, 'apps/api'),
    entry: resolve(root, 'apps/api/node_modules/tsx/dist/cli.mjs'),
    args: ['watch', 'src/server.ts'],
  },
  {
    name: 'web',
    cwd: resolve(root, 'apps/web'),
    entry: resolve(root, 'apps/web/node_modules/vite/bin/vite.js'),
    args: [],
  },
];

function assertPortAvailable(port, host) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once('error', (error) => rejectPromise(error));
    server.listen(port, host, () => server.close(resolvePromise));
  });
}

try {
  await Promise.all([assertPortAvailable(3001, '127.0.0.1'), assertPortAvailable(5173, '::1')]);
} catch (error) {
  if (error?.code === 'EADDRINUSE') {
    console.error('Masaar is already running in another terminal.');
    console.error('Use http://localhost:5173, or stop the other session with Ctrl+C before restarting.');
    process.exit(1);
  }
  throw error;
}

let stopping = false;
const children = services.map((service) => {
  const child = spawn(process.execPath, [service.entry, ...service.args], {
    cwd: service.cwd,
    env: process.env,
    stdio: 'inherit',
  });
  child.serviceName = service.name;
  return child;
});

console.log('Starting Masaar development services…');
console.log('Web: http://localhost:5173');
console.log('API: http://127.0.0.1:3001');
console.log('Press Ctrl+C once to stop both services cleanly.');

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping Masaar development services…');
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  const fallback = setTimeout(() => process.exit(exitCode), 2500);
  fallback.unref();
  Promise.all(children.map((child) => new Promise((done) => child.once('exit', done)))).then(() => {
    console.log('Masaar stopped cleanly.');
    process.exit(exitCode);
  });
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`${child.serviceName} could not start:`, error.message);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`${child.serviceName} stopped unexpectedly (${signal ?? `exit ${code ?? 1}`}).`);
    stop(code && code !== 0 ? code : 1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
