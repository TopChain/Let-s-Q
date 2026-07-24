import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'package.json',
  'capacitor.config.json',
  'index.html',
  'app.html',
  'privacy.html',
  'delete-data.html',
  'runtime-config.js',
  'live-queue.js',
  'app-shell.js',
  'supabase/schema.sql',
  'supabase/migrations/20260717_public_queue_details.sql',
  'supabase/migrations/20260718_short_queue_codes.sql',
  'www/index.html',
  'www/app.html',
  'www/live-queue.js',
  'www/app-shell.js',
  'www/vendor/supabase.js',
  'www/vendor/qrcode.js',
  'www/vendor/qr-scanner.js',
  'www/_redirects',
  "www/Let's Q Web logo.jpeg",
  "www/Let's Q app logo.jpeg"
];

const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length) throw new Error(`Missing required foundation files:\n${missing.join('\n')}`);

const html = readFileSync(resolve(root, 'www/index.html'), 'utf8');
if (!html.includes('app.html')) throw new Error('The web app does not load the Let’s Q app shell.');

const app = readFileSync(resolve(root, 'www/app.html'), 'utf8');
if (!app.includes('startLaunchAd')) throw new Error('The packaged app is missing the launch ad flow.');
if (!app.includes('openReportAd')) throw new Error('The packaged app is missing the report unlock flow.');

const privacy = readFileSync(resolve(root, 'www/privacy.html'), 'utf8');
if (!privacy.includes('letsqsupportteam@gmail.com')) throw new Error('The published privacy policy is missing the support contact.');

const deletion = readFileSync(resolve(root, 'www/delete-data.html'), 'utf8');
if (!deletion.includes('letsqsupportteam@gmail.com')) throw new Error('The published data deletion page is missing the support contact.');

console.log('Shared mobile foundation check: OK');
