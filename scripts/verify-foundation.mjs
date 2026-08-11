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
  'firebase-config.js',
  'live-queue.js',
  'app-shell.js',
  'scripts/firebase-browser-entry.js',
  'supabase/schema.sql',
  'supabase/migrations/20260717_public_queue_details.sql',
  'supabase/migrations/20260718_short_queue_codes.sql',
  'supabase/migrations/20260811_support_current_app_compatibility.sql',
  'www/index.html',
  'www/app.html',
  'www/firebase-config.js',
  'www/live-queue.js',
  'www/app-shell.js',
  'www/vendor/firebase.js',
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
if (!app.includes('vendor/firebase.js')) throw new Error('The current app shell is missing its compatibility bridge script.');

const bridgeSource = readFileSync(resolve(root, 'scripts/firebase-browser-entry.js'), 'utf8');
if (!bridgeSource.includes("from '@supabase/supabase-js'")) throw new Error('The current app compatibility bridge is not backed by Supabase.');
if (/from ['"]firebase\//.test(bridgeSource)) throw new Error('Firebase queue SDK imports were reintroduced into the production bridge.');
if (!bridgeSource.includes("get backend() { return 'supabase'; }")) throw new Error('The compatibility bridge does not declare Supabase as its queue backend.');

const compatConfig = readFileSync(resolve(root, 'firebase-config.js'), 'utf8');
if (!compatConfig.includes('exqsdvzgoivacpqqdott.supabase.co')) throw new Error('The compatibility config is not pointed at the canonical Let’s Q Supabase project.');

const runtimeConfig = readFileSync(resolve(root, 'runtime-config.js'), 'utf8');
if (!runtimeConfig.includes('exqsdvzgoivacpqqdott.supabase.co')) throw new Error('The runtime config is not pointed at the canonical Let’s Q Supabase project.');

const privacy = readFileSync(resolve(root, 'www/privacy.html'), 'utf8');
if (!privacy.includes('letsqsupportteam@gmail.com')) throw new Error('The published privacy policy is missing the support contact.');

const deletion = readFileSync(resolve(root, 'www/delete-data.html'), 'utf8');
if (!deletion.includes('letsqsupportteam@gmail.com')) throw new Error('The published data deletion page is missing the support contact.');

console.log('Shared mobile foundation check: OK — canonical queue backend is Supabase.');
