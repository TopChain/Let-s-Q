import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'package.json',
  'capacitor.config.json',
  'index.html',
  'privacy.html',
  'delete-data.html',
  'runtime-config.js',
  'live-queue.js',
  'supabase/schema.sql',
  'supabase/migrations/20260717_public_queue_details.sql',
  'supabase/migrations/20260718_short_queue_codes.sql',
  'www/index.html',
  'www/live-queue.js',
  'www/vendor/supabase.js',
  'www/vendor/qrcode.js',
  'www/_redirects',
  "www/Let's Q Web logo.jpeg",
  "www/Let's Q app logo.jpeg"
];

const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length) throw new Error(`Missing required foundation files:\n${missing.join('\n')}`);

const html = readFileSync(resolve(root, 'www/index.html'), 'utf8');
if (!html.includes('runtime-config.js')) throw new Error('The web app does not load runtime-config.js.');
if (!html.includes('live-queue.js')) throw new Error('The web app does not load the live queue bridge.');
if (!html.includes('Let%27s%20Q%20Web%20logo.jpeg')) throw new Error('The web logo is not in the packaged app.');

const privacy = readFileSync(resolve(root, 'www/privacy.html'), 'utf8');
if (!privacy.includes('letsqsupportteam@gmail.com')) throw new Error('The published privacy policy is missing the support contact.');

const deletion = readFileSync(resolve(root, 'www/delete-data.html'), 'utf8');
if (!deletion.includes('letsqsupportteam@gmail.com')) throw new Error('The published data deletion page is missing the support contact.');

console.log('Shared mobile foundation check: OK');
