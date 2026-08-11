# Supabase production cutover gate

This branch makes Supabase project `exqsdvzgoivacpqqdott` the single Let’s Q queue backend.

The current `app.html` still calls the legacy global `window.LetsQFirebase`; the source adapter in `scripts/firebase-browser-entry.js` now preserves that API name while routing every queue operation through Supabase. This avoids a risky 2 MB HTML rewrite and removes Firebase as the queue source of truth.

Before merging this branch:

1. In Supabase project `exqsdvzgoivacpqqdott`, enable **Authentication → Allow anonymous sign-ins**. Queuers remain unauthenticated; a private anonymous Supabase identity is created lazily only when a device starts using Host features.
2. Run `pnpm run web:build` (or the normal deployment build) so `vendor/firebase.js` is regenerated from the new Supabase compatibility source.
3. Create one Host queue on a real browser/device, then open its QR/short code from a second private session. Confirm join, live status, call/serve, cancel, pause/resume, no-show, walk-in, and anonymous rating.
4. Re-run Supabase security/performance advisors. Performance should have no actionable lints. Narrow SECURITY DEFINER Queuer RPC warnings are intentional and documented in `docs/PRODUCTION_BACKEND.md`.
5. Only then merge/deploy this branch.

Do not restore Firebase or `tjjvltvqzjgulgcknozk` as the default queue backend unless there is an explicit disaster-recovery decision.
