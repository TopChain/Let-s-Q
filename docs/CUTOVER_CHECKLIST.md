# Neon production cutover gate

Before merging or publishing version 1.3.5:

1. Apply `neon/schema.sql`, `neon/legacy-schema.sql`, then the private legacy export to the existing Let’s Q Neon project.
2. Save `DATABASE_URL` and a new 32-byte-or-longer `RATE_LIMIT_SECRET` as Netlify Function environment variables.
3. Deploy the existing Let’s Q Netlify site and confirm the API health endpoint returns `ok`.
4. In separate sessions, test Host creation/resume, join, call/serve, cancel, pause/resume, no-show, walk-in, rating, and report.
5. Confirm GitHub Android and unsigned iOS simulator jobs pass.
6. Test signed Android/iOS builds on real devices using the existing store signing identities.
7. Verify the deployed privacy and deletion pages, Google Play Data safety, and App Store privacy answers.

Keep Supabase as a temporary rollback source until all checks pass. Then it can be retired in a separate, explicitly approved action.
