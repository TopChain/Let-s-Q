# Let’s Q Supabase deployment

For a brand-new Let’s Q Supabase project:

1. Apply `supabase/schema.sql`.
2. Apply every file in `supabase/migrations/` in filename order.
3. Enable **Authentication → Allow anonymous sign-ins** before pointing a live Host client at the project. The Host flow uses `signInAnonymously()` to create a private, no-PII Host identity.
4. Run Supabase Security and Performance Advisors after DDL changes.
5. Test Host create/manage/end queue plus Queuer open/join/status/cancel/rating before production cutover.

Important platform behavior in 2026: new Supabase projects may not expose new `public` tables/functions to the Data API automatically. The migrations in this repository deliberately use explicit grants and revoke broad defaults. Do not replace them with blanket `grant all ... to anon, authenticated` statements.

The current canonical production project and cutover history are recorded in `docs/PRODUCTION_BACKEND.md`.
