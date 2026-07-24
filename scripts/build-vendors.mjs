import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const vendor = resolve(root, 'vendor');
mkdirSync(vendor, { recursive: true });

const common = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  logLevel: 'silent'
};

await build({ ...common, entryPoints: [resolve(root, 'scripts/supabase-browser-entry.js')], outfile: resolve(vendor, 'supabase.js') });
await build({ ...common, entryPoints: [resolve(root, 'scripts/qr-browser-entry.js')], outfile: resolve(vendor, 'qrcode.js') });
await build({ ...common, entryPoints: [resolve(root, 'scripts/qr-scanner-browser-entry.js')], outfile: resolve(vendor, 'qr-scanner.js') });
