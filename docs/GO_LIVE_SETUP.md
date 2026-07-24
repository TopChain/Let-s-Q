# Let’s Q go-live setup

This folder is prepared for a Netlify web deploy and a Capacitor Android release. It deliberately keeps guest use account-free: a guest can join with a ticket number and private passphrase, while a Host must be authenticated before managing a queue.

## 1. Supabase

The public project URL and `sb_publishable_...` key are already in `runtime-config.js`. A publishable key is safe to include in a web or mobile app; do not put an `sb_secret_...` or `service_role` key in this folder.

In the Supabase Dashboard, open the intended project and run the files in this order in the SQL Editor:

1. `supabase/schema.sql`
2. `supabase/migrations/20260717_public_queue_details.sql`
3. `supabase/migrations/20260718_short_queue_codes.sql`
4. `supabase/migrations/20260723_unlimited_queue_capacity.sql`

Then verify the tables `queues`, `tickets`, `ratings`, `host_profiles`, and `billing_entitlements` exist and have Row Level Security enabled. The final migration makes queue capacity optional, so Hosts can set a serving goal or an unlimited queue without blocking people from joining.

Before enabling real store-photo uploads, create a private Storage bucket (for example `queue-images`) and add upload/read policies that only allow the owning authenticated Host to write. The browser simulation previews a local photo only; it does not upload an image yet.

## 2. Netlify

`netlify.toml` builds with `pnpm run web:build` and publishes `www/`. In Netlify, connect this repository to the existing Let’s Q site, confirm the root directory is this folder, and deploy. The build copies `app.html`, the Supabase configuration, the privacy pages, and the SPA redirect into `www/`.

After the first deploy, test these URLs:

- `/`
- `/privacy.html`
- `/delete-data.html`
- a `/join/...` link, which should fall back to the app through `_redirects`

Do not put a Supabase secret key in Netlify's public build output. If a future server task needs one (receipt verification, admin work, or image signing), store it only in Netlify environment variables or a Supabase Edge Function.

## 3. AdMob and the optional subscription

Android already contains the Let’s Q AdMob app ID, production banner unit, rating interstitial unit, a visible consent flow, and `app-ads.txt`. Debug builds deliberately use Google test units. Keep the browser's opening and report ads labelled as simulations; a website cannot serve Android AdMob placements.

Before a production Android build:

1. Confirm the app and ad-unit IDs in `MainActivity.java` match the AdMob console.
2. Add the public Netlify domain as the app-ads.txt domain in AdMob, then confirm `https://YOUR-DOMAIN/app-ads.txt` serves the existing file.
3. Complete the UMP consent message and Google Play Data Safety declaration from the final SDK list.
4. Create the Play Billing subscription with the exact immutable product ID `letsq_ad_free_monthly` and price it at $1/month (or the price you choose before launch).
5. Test only with the included Google test IDs before publishing.

The current release build has a native anchored bottom banner and rating interstitial. A true opening placement should be implemented as an AdMob **App Open** ad, not a hand-timed HTML screen; a report reward should use an approved rewarded-ad flow before it is advertised as a 30-second unlock.

## 4. Published-app update (when ready)

The Android package is `app.letsq.queue`, currently `versionCode 3` / `versionName 1.2`. Before uploading an update, increase the version code, make an Android App Bundle signed with the same Play upload key, test it on the internal track, then create a production release with final release notes. Do not publish until the Netlify deploy, real queue flows, consent, store listing, privacy policy, and Data Safety declaration have all been checked.
