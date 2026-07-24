# Let’s Q: real app foundation

This folder is now prepared as one Capacitor project. The same `index.html`, CSS, JavaScript, logos, and QR assets are copied into `www/` for Android and iOS builds. The root `index.html` remains your easy browser preview.

## What is ready

- One shared web interface for Android, iPhone, iPad, and web.
- Capacitor configuration for Android and iOS.
- Host/Queuer data model and secure, anonymous queue-join functions in `supabase/schema.sql`.
- A strong random ticket access token instead of using a short secret code as authorization.
- Data model for anonymous ratings and store-verified paid entitlements.

## What still needs account-side confirmation before it can be live

1. The public Supabase URL and publishable key are now configured in `runtime-config.js`; confirm the schema and migrations have been applied in that project and review every Row Level Security policy.
2. Configure the production Netlify deploy using `netlify.toml`, then verify the deployed privacy and deletion pages.
3. Create the Google Play billing product for the $1/month plan. Receipt verification must be done by a secure server, never in `runtime-config.js`.
4. Create the Apple equivalents before an iOS release.

For the account-side checklist and release order, see `docs/GO_LIVE_SETUP.md`.

## Important privacy boundary

Queuers need no account, email, or phone number. Hosts need an authenticated Host profile so only the Host can see their queue and so paid access can be restored. The short secret code is only a human-friendly check; the random ticket token is the real authorization.
