# Let’s Q production backend

## Canonical architecture

- Database: the existing **Let’s Q** Neon project
- API: `netlify/functions/letsq-api.mjs`
- Browser/mobile endpoint: `/.netlify/functions/letsq-api`
- Scheduled retention cleanup: `netlify/functions/letsq-cleanup.mjs`
- Previous Supabase Let’s Q project: migration/rollback source only

The app no longer exposes a database URL or key. Netlify Functions hold `DATABASE_URL` and `RATE_LIMIT_SECRET`; all queue access is validated server-side. Hosts use random bearer sessions stored only as SHA-256 hashes, while Queuers remain accountless and receive random ticket access tokens.

## Data migration

The Supabase production tables and Auth/Storage contained no live rows. Only the archive schema contained 5 prototype queues and 6 prototype tickets. A private one-time export preserves those 11 rows in `letsq_legacy`; row values and old device tokens are intentionally excluded from public source control. `neon/legacy-manifest.json` records the counts, while `neon/schema.sql` creates the new production schema.

Apply both SQL files to the existing Let’s Q Neon project in this order:

1. `neon/schema.sql`
2. `neon/legacy-schema.sql`
3. The private one-time legacy export held by the migration operator

Do not delete or pause the Supabase project until the Neon deployment and real-device smoke test pass.

## Required Netlify secrets

- `DATABASE_URL`: pooled Neon connection string with SSL enabled
- `RATE_LIMIT_SECRET`: at least 32 random bytes, used only for keyed abuse-prevention hashes

Never place either value in source, `runtime-config.js`, mobile assets, logs, or a public Netlify build variable.
