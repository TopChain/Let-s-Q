import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  '.github/workflows/release-builds.yml',
  'package.json',
  'capacitor.config.json',
  'index.html',
  'app.html',
  'privacy.html',
  'delete-data.html',
  'runtime-config.js',
  'firebase-config.js',
  'app-shell.js',
  'scripts/firebase-browser-entry.js',
  'scripts/neon-api-client.js',
  'scripts/report-browser-entry.js',
  'scripts/ui-hardening-entry.js',
  'scripts/production-bridge-entry.js',
  'neon/schema.sql',
  'neon/legacy-schema.sql',
  'neon/legacy-manifest.json',
  'netlify/functions/letsq-api.mjs',
  'netlify/functions/letsq-cleanup.mjs',
  'ios/App/App/PrivacyInfo.xcprivacy',
  'ios/App/App.xcodeproj/project.pbxproj',
  'www/index.html',
  'www/app.html',
  'www/firebase-config.js',
  'www/app-shell.js',
  'www/vendor/firebase.js',
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
for (const retiredCopy of ['Interactive prototype', 'This local demo', 'in this demo', 'This simulation', 'Finish Firebase setup', 'stored securely in Firebase']) {
  if (app.includes(retiredCopy)) throw new Error(`Store-facing app copy still contains: ${retiredCopy}`);
}
if (!app.includes('The queue service is unavailable. Please try again shortly.')) throw new Error('The packaged app can still silently simulate queue operations when the API is unavailable.');

const bridgeSource = readFileSync(resolve(root, 'scripts/firebase-browser-entry.js'), 'utf8');
if (!bridgeSource.includes("from './neon-api-client.js'")) throw new Error('The current app compatibility bridge is not backed by the Neon API.');
if (/from ['"](?:firebase\/|@supabase\/)/.test(bridgeSource)) throw new Error('A retired queue SDK was reintroduced into the production bridge.');
if (!bridgeSource.includes("get backend() { return 'neon'; }")) throw new Error('The compatibility bridge does not declare Neon as its queue backend.');
if (!bridgeSource.includes('restoreHostQueue')) throw new Error('The compatibility bridge cannot restore a saved Host queue after relaunch.');
if (!bridgeSource.includes('restoreSavedHostIntoUi')) throw new Error('The app shell cannot resume a saved Host queue after relaunch.');

const reportSource = readFileSync(resolve(root, 'scripts/report-browser-entry.js'), 'utf8');
if (!reportSource.includes("apiRequest('get-report'")) throw new Error('Q Report is not reading Neon-backed ticket aggregates.');
if (!reportSource.includes('Export report as PDF')) throw new Error('Q Report is missing PDF export.');

const hardeningSource = readFileSync(resolve(root, 'scripts/ui-hardening-entry.js'), 'utf8');
if (!hardeningSource.includes("type === 'staff' || type === 'settings'")) throw new Error('Demo-only staff/settings controls are not blocked.');
if (!hardeningSource.includes('This release does not send push notifications')) throw new Error('The close-queue UI can still imply nonexistent push notifications.');
if (!hardeningSource.includes('A real anonymous ticket number is assigned')) throw new Error('The walk-in UI can still show a fake ticket before creation.');
if (!hardeningSource.includes("getPlatform?.() === 'ios'")) throw new Error('Native iOS report monetization is not guarded.');
if (!hardeningSource.includes('Q Report is included on iPhone in this build.')) throw new Error('The iOS build can still imply a fake report charge or ad.');
if (!hardeningSource.includes("button:not([data-ios-report-button])")) throw new Error('The iOS build does not hide every unsupported report purchase/ad control.');
if (!hardeningSource.includes('removePrototypeMetrics')) throw new Error('Prototype metrics can still appear as production data.');
if (!hardeningSource.includes('ensureWebAdShell')) throw new Error('The web report reward cannot recover if the original ad shell is missing.');
if (!hardeningSource.includes('resumeInterruptedStartup')) throw new Error('A failed ad-shell mount can still prevent QR deep links from opening.');
if (!hardeningSource.includes('hideUnsupportedTicketSharing')) throw new Error('The release can still expose the prototype ticket-sharing flow.');
if (!hardeningSource.includes("style.setProperty('display', 'none', 'important')")) throw new Error('Author styles can still override hidden production controls.');
if (!hardeningSource.includes('hardenCancelModal')) throw new Error('The cancel confirmation can still display a fake ticket number.');
if (!hardeningSource.includes('installIosViewportLayout')) throw new Error('The iOS viewport layout fix is not bundled.');
if (!hardeningSource.includes('position:fixed!important;top:auto!important;bottom:0!important')) throw new Error('The iOS navigation is not pinned to the bottom viewport edge.');
if (!hardeningSource.includes('replaceIosAdFallback')) throw new Error('The iOS no-fill Let’s Q tip fallback is not bundled.');
if (!hardeningSource.includes("type === 'staff' || type === 'settings' || type === 'share'")) throw new Error('The prototype share modal is not blocked.');

if (!bridgeSource.includes("apiRequest('get-ticket'")) throw new Error('Queuer polling is not using the Neon ticket endpoint.');
if (!bridgeSource.includes("document.visibilityState === 'visible'")) throw new Error('Background queue polling protection is missing.');
if (!bridgeSource.includes('}, 15000);')) throw new Error('Queuer polling cadence is not hardened to 15 seconds.');

const productionEntry = readFileSync(resolve(root, 'scripts/production-bridge-entry.js'), 'utf8');
for (const source of ['./firebase-browser-entry.js', './report-browser-entry.js', './ui-hardening-entry.js']) {
  if (!productionEntry.includes(source)) throw new Error(`The production bridge is missing ${source}.`);
}

const buildVendors = readFileSync(resolve(root, 'scripts/build-vendors.mjs'), 'utf8');
if (!buildVendors.includes('production-bridge-entry.js')) throw new Error('vendor/firebase.js is not built from the production Neon bridge.');
if (buildVendors.includes('supabase-browser-entry.js')) throw new Error('The retired Supabase browser bundle is still being built.');

const compatConfig = readFileSync(resolve(root, 'firebase-config.js'), 'utf8');
if (!compatConfig.includes('/.netlify/functions/letsq-api')) throw new Error('The compatibility config is not pointed at the Let’s Q API.');

const runtimeConfig = readFileSync(resolve(root, 'runtime-config.js'), 'utf8');
if (!runtimeConfig.includes('/.netlify/functions/letsq-api')) throw new Error('The runtime config is not pointed at the Let’s Q API.');
if (/supabaseUrl|supabaseAnonKey/.test(runtimeConfig)) throw new Error('Supabase credentials remain in the public runtime config.');

const neonSchema = readFileSync(resolve(root, 'neon/schema.sql'), 'utf8');
for (const marker of ['letsq.host_sessions', 'letsq.join_queue', 'extensions.crypt', 'letsq.consume_rate_limit', 'for update', 'enable row level security']) {
  if (!neonSchema.includes(marker)) throw new Error(`The Neon schema is missing ${marker}.`);
}
const apiSource = readFileSync(resolve(root, 'netlify/functions/letsq-api.mjs'), 'utf8');
for (const marker of ['process.env.DATABASE_URL', 'process.env.RATE_LIMIT_SECRET', 'authenticateHost', "case 'health'"]) {
  if (!apiSource.includes(marker)) throw new Error(`The Neon API is missing ${marker}.`);
}

const iosPrivacy = readFileSync(resolve(root, 'ios/App/App/PrivacyInfo.xcprivacy'), 'utf8');
for (const key of ['NSPrivacyTracking', 'NSPrivacyCollectedDataTypeUserID', 'NSPrivacyCollectedDataTypeOtherUserContent', 'NSPrivacyCollectedDataTypeProductInteraction']) {
  if (!iosPrivacy.includes(key)) throw new Error(`The iOS privacy manifest is missing ${key}.`);
}
if (/<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<true\/>/.test(iosPrivacy)) throw new Error('Anonymous queue data is incorrectly declared as linked to a real-world identity.');
const xcodeProject = readFileSync(resolve(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
if (!xcodeProject.includes('PrivacyInfo.xcprivacy in Resources')) throw new Error('The iOS privacy manifest is not bundled in the app target.');
if (!xcodeProject.includes('PRODUCT_BUNDLE_IDENTIFIER = com.letsq.app;')) throw new Error('The iOS bundle ID does not match the existing App Store Connect record.');
const iosInfo = readFileSync(resolve(root, 'ios/App/App/Info.plist'), 'utf8');
if (!iosInfo.includes('ITSAppUsesNonExemptEncryption')) throw new Error('The iOS export-compliance declaration is missing.');

const androidGradle = readFileSync(resolve(root, 'android/app/build.gradle'), 'utf8');
for (const marker of ['LETSQ_UPLOAD_STORE_FILE', 'LETSQ_UPLOAD_STORE_PASSWORD', 'LETSQ_UPLOAD_KEY_ALIAS', 'LETSQ_UPLOAD_KEY_PASSWORD']) {
  if (!androidGradle.includes(marker)) throw new Error(`Android release signing is missing ${marker}.`);
}
const releaseWorkflow = readFileSync(resolve(root, '.github/workflows/release-builds.yml'), 'utf8');
for (const marker of ['bundleRelease', 'app-release.aab', 'xcodebuild archive', 'LetsQ-1.3.5-3.ipa']) {
  if (!releaseWorkflow.includes(marker)) throw new Error(`The signed store-build workflow is missing ${marker}.`);
}

const privacy = readFileSync(resolve(root, 'www/privacy.html'), 'utf8');
if (!privacy.includes('letsqsupportteam@gmail.com')) throw new Error('The published privacy policy is missing the support contact.');
if (!privacy.includes('Netlify') || !privacy.includes('Neon')) throw new Error('The published privacy policy is not aligned with the Neon backend.');
if (!privacy.includes('within 30 days')) throw new Error('The published privacy policy is missing the queue retention period.');

const deletion = readFileSync(resolve(root, 'www/delete-data.html'), 'utf8');
if (!deletion.includes('letsqsupportteam@gmail.com')) throw new Error('The published data deletion page is missing the support contact.');

console.log('Shared mobile foundation check: OK — Neon queue API, private Host sessions, consolidated polling, real reports/PDF, production UI hardening, and iOS privacy guards are bundled.');
