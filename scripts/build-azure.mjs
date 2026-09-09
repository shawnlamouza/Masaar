import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('apps/web/dist');
const destination = resolve('apps/api/dist/public');

if (!existsSync(source))
  throw new Error('Build the Masaar web application before packaging Azure.');
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });

console.log(`Prepared Azure web assets in ${destination}`);
