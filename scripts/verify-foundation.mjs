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
  'scripts/report-browser-entry.js',
  'scripts/ui-hardening-entry.js',
  'scripts/production-bridge-entry.js',
  'supabase/schema.sql',
  'supabase/migrations/20260717_public_queue_details.sql',
  'supabase/migrations/20260718_short_queue_codes.sql',
  'supabase/migrations/20260811_support_current_app_compatibility.sql',
  'supabase/migrations/20260811_enforce_no_show_policies.sql',
  'supabase/migrations/20260811_fix_no_show_rls_transition.sql',
  'ios/App/App/PrivacyInfo.xcprivacy',
  'ios/App/App.xcodeproj/project.pbxproj',
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

const reportSource = readFileSync(resolve(root, 'scripts/report-browser-entry.js'), 'utf8');
if (!reportSource.includes("api.from('tickets')")) throw new Error('Q Report is not reading live ticket aggregates.');
if (!reportSource.includes("api.from('ratings')")) throw new Error('Q Report is not reading live anonymous ratings.');
if (!reportSource.includes('Export report as PDF')) throw new Error('Q Report is missing PDF export.');

const hardeningSource = readFileSync(resolve(root, 'scripts/ui-hardening-entry.js'), 'utf8');
if (!hardeningSource.includes("type === 'staff' || type === 'settings'")) throw new Error('Demo-only staff/settings controls are not blocked.');
if (!hardeningSource.includes('This release does not send push notifications')) throw new Error('The close-queue UI can still imply nonexistent push notifications.');
if (!hardeningSource.includes('A real anonymous ticket number is assigned')) throw new Error('The walk-in UI can still show a fake ticket before creation.');
if (!hardeningSource.includes("getPlatform?.() === 'ios'")) throw new Error('Native iOS report monetization is not guarded.');
if (!hardeningSource.includes('Q Report is included on iPhone in this build.')) throw new Error('The iOS build can still imply a fake report charge or ad.');

const productionEntry = readFileSync(resolve(root, 'scripts/production-bridge-entry.js'), 'utf8');
for (const source of ['./firebase-browser-entry.js', './report-browser-entry.js', './ui-hardening-entry.js']) {
  if (!productionEntry.includes(source)) throw new Error(`The production bridge is missing ${source}.`);
}

const buildVendors = readFileSync(resolve(root, 'scripts/build-vendors.mjs'), 'utf8');
if (!buildVendors.includes('production-bridge-entry.js')) throw new Error('vendor/firebase.js is not built from the production Supabase bridge.');

const compatConfig = readFileSync(resolve(root, 'firebase-config.js'), 'utf8');
if (!compatConfig.includes('exqsdvzgoivacpqqdott.supabase.co')) throw new Error('The compatibility config is not pointed at the canonical Let’s Q Supabase project.');

const runtimeConfig = readFileSync(resolve(root, 'runtime-config.js'), 'utf8');
if (!runtimeConfig.includes('exqsdvzgoivacpqqdott.supabase.co')) throw new Error('The runtime config is not pointed at the canonical Let’s Q Supabase project.');

const iosPrivacy = readFileSync(resolve(root, 'ios/App/App/PrivacyInfo.xcprivacy'), 'utf8');
for (const key of ['NSPrivacyTracking', 'NSPrivacyCollectedDataTypeUserID', 'NSPrivacyCollectedDataTypeOtherUserContent', 'NSPrivacyCollectedDataTypeProductInteraction']) {
  if (!iosPrivacy.includes(key)) throw new Error(`The iOS privacy manifest is missing ${key}.`);
}
const xcodeProject = readFileSync(resolve(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
if (!xcodeProject.includes('PrivacyInfo.xcprivacy in Resources')) throw new Error('The iOS privacy manifest is not bundled in the app target.');

const privacy = readFileSync(resolve(root, 'www/privacy.html'), 'utf8');
if (!privacy.includes('letsqsupportteam@gmail.com')) throw new Error('The published privacy policy is missing the support contact.');

const deletion = readFileSync(resolve(root, 'www/delete-data.html'), 'utf8');
if (!deletion.includes('letsqsupportteam@gmail.com')) throw new Error('The published data deletion page is missing the support contact.');

console.log('Shared mobile foundation check: OK — Supabase queue, real reports/PDF, production UI hardening, and iOS privacy guards are bundled.');
