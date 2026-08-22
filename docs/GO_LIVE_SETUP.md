# Let’s Q go-live setup

## Neon and Netlify

1. Apply `neon/schema.sql`, `neon/legacy-schema.sql`, and the private legacy export to the existing Let’s Q Neon project.
2. In the existing Let’s Q Netlify site, add Function secrets `DATABASE_URL` and `RATE_LIMIT_SECRET`.
3. Deploy from this repository. `netlify.toml` builds `www/` and deploys the API plus daily retention cleanup.
4. Test `/`, `/privacy.html`, `/delete-data.html`, `/.netlify/functions/letsq-api?action=health`, and a `/join/...` deep link.

Do not expose the Neon connection string in browser or mobile configuration.

## Android update

- Package: `app.letsq.queue`
- Version: `1.3.5` (`versionCode 9`)
- Build a signed AAB with the existing Play upload key.
- Test on the internal track, confirm AdMob/UMP and Play Billing, then promote after the production API smoke test.
- The project targets Android 16 / API 36 and uses Play Billing Library 8, meeting the August 2026 update gates.

## iOS update

- Bundle ID: `app.letsq.queue`
- Version: `1.3.5` (build `2`)
- Archive with the existing Apple distribution identity and provisioning profile.
- Q Report remains free on iOS because StoreKit and the iOS ads SDK are not in this release.
- Upload to TestFlight, complete privacy/export-compliance answers, test, then submit for review.
- Produce the App Store archive with Xcode 26 or later and an iOS 26 SDK.
