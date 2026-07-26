import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

await import('./build-vendors.mjs');

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'www');
const publicFiles = [
  'index.html',
  'app.html',
  'privacy.html',
  'delete-data.html',
  'runtime-config.js',
  'firebase-config.js',
  'app-ads.txt',
  'i18n-extra.js',
  'app-shell.js',
  'live-queue.js',
  '_redirects',
  "Let's Q Web logo.jpeg",
  "Let's Q app logo.jpeg",
  'queue-join-demo.svg',
  'staff-pair-demo.svg',
  'ticket-share-demo.svg'
];
const vendorFiles = [
  {
    source: resolve(root, 'vendor/firebase.js'),
    destination: 'vendor/firebase.js'
  },
  {
    source: resolve(root, 'vendor/supabase.js'),
    destination: 'vendor/supabase.js'
  },
  {
    source: resolve(root, 'vendor/qrcode.js'),
    destination: 'vendor/qrcode.js'
  },
  {
    source: resolve(root, 'vendor/qr-scanner.js'),
    destination: 'vendor/qr-scanner.js'
  }
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of publicFiles) {
  const source = resolve(root, file);
  if (!existsSync(source)) throw new Error(`Required app asset is missing: ${file}`);
  cpSync(source, resolve(output, file));
}

for (const file of vendorFiles) {
  if (!existsSync(file.source)) throw new Error(`Required app vendor file is missing: ${file.source}`);
  const destination = resolve(output, file.destination);
  mkdirSync(resolve(destination, '..'), { recursive: true });
  cpSync(file.source, destination);
}

console.log(`Prepared ${publicFiles.length} web assets and ${vendorFiles.length} vendor file for Capacitor.`);
