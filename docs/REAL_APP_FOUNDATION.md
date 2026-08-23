# Let’s Q: real app foundation

This folder is now prepared as one Capacitor project. The same `index.html`, CSS, JavaScript, logos, and QR assets are copied into `www/` for Android and iOS builds. The root `index.html` remains your easy browser preview.

## What is ready

- One shared web interface for Android, iPhone, iPad, and web.
- Capacitor configuration for Android and iOS.
- Host/Queuer data model and secure, anonymous queue functions in `neon/schema.sql`.
- A strong random ticket access token instead of using a short secret code as authorization.
- Data model for anonymous ratings and store-verified paid entitlements.

## What still needs account-side confirmation before it can be live

1. Apply `neon/schema.sql`, `neon/legacy-schema.sql`, and the private legacy export to the existing Let’s Q Neon project.
2. Configure the private `DATABASE_URL` and `RATE_LIMIT_SECRET` in the production Netlify site, deploy, then verify the API, privacy, and deletion pages.
3. Create the Google Play billing product for the $1/month plan. Receipt verification must be done by a secure server, never in `runtime-config.js`.
4. Q Report remains free on iOS until an Apple-compliant StoreKit implementation is added.

For the account-side checklist and release order, see `docs/GO_LIVE_SETUP.md`.

## Important privacy boundary

Queuers need no account, email, or phone number. Hosts receive a random private bearer session so only that Host can manage its queues. The short secret code is only a human-friendly check; the random ticket token is the real authorization.
