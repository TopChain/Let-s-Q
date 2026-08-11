# Supabase production cutover gate

This branch switches `runtime-config.js` from the retired Supabase project to the canonical Let’s Q project `exqsdvzgoivacpqqdott`.

Before merging this branch:

1. In Supabase project `exqsdvzgoivacpqqdott`, enable **Authentication → Allow anonymous sign-ins**. The Host flow calls `supabase.auth.signInAnonymously()` and anonymous sign-ins are disabled by default on hosted Supabase projects.
2. Create one Host queue on a real browser/device and confirm the Host profile/queue can be created.
3. Scan/open its QR or short code from a second private session and confirm a Queuer can join, refresh status, cancel, and submit a rating after being served.
4. Re-run Supabase security/performance advisors. Performance should have no actionable lints. SECURITY DEFINER warnings for the narrow public Queuer RPCs are intentional and documented in `docs/PRODUCTION_BACKEND.md`.
5. Merge this branch only after steps 1–4 pass. Netlify/Android web assets can then use the new project without a backend outage.

Do not restore `tjjvltvqzjgulgcknozk` as the default backend unless there is an explicit disaster-recovery decision.
