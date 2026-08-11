# Let’s Q production backend

## Canonical Supabase project

The intended production backend is now:

- Project name: `Let's Q`
- Project ref: `exqsdvzgoivacpqqdott`
- API URL: `https://exqsdvzgoivacpqqdott.supabase.co`
- Region: `us-west-2`
- PostgreSQL: 17

Do not switch production back to the retired project ref `tjjvltvqzjgulgcknozk` unless there is an explicit disaster-recovery decision.

## 2026-08-11 migration record

The new project originally contained an older prototype schema with 5 queues and 6 tickets. Those rows were preserved instead of deleted:

- `letsq_legacy.queues`
- `letsq_legacy.tickets`

The legacy schema is not part of the app Data API surface. Anonymous/authenticated clients have no table access to it.

The current production schema was then installed in `public`, including Host-owned queues, token-authorized Queuer RPCs, ratings, billing entitlements, RLS, explicit Data API grants, queue-join serialization, and the unlimited-queue COUNT optimization.

Additional hardening applied on 2026-08-11:

- revoked broad automatic Data API table grants and adopted explicit least-privilege grants
- revoked default public function execution for future functions
- added FK indexes for `queues.owner_id` and `queue_staff.host_id`
- normalized rating RPC parameters to standard integer JSON values while enforcing the 1–5 range
- expanded the public queue/ticket RPCs so the production client can refresh a Queuer in one RPC rather than a ticket RPC plus a second queue RPC
- added the production UI compatibility fields `event_name` and `accepting_entries`
- enforced Host-selected no-show behavior in the database, including cancel, defer, timed hold, third-strike cancellation, and queue-close cleanup
- fixed the hold transition so the Host UPDATE passes RLS before an unexpired hold becomes intentionally hidden from the Host waiting-list query
- verified anonymous clients cannot SELECT queue tables directly
- verified public queue lookup, join, ticket status, cancellation, Host RLS updates, anonymous rating, hashed secret codes, no-show transitions, hidden hold behavior, queue close cleanup, and cleanup using synthetic test data
- verified the report query surface under Host RLS using synthetic tickets and ratings, then removed all synthetic production rows
- performance advisor returned no remaining lints after the fixes

The `public` app tables were empty after the verification cleanup. The preserved prototype rows remain only in `letsq_legacy`.

## Required Auth setting before runtime cutover

The browser app creates a private Host identity using Supabase `signInAnonymously()`. Supabase hosted projects have anonymous sign-ins disabled by default, so **Authentication → Providers/General → Allow anonymous sign-ins must be enabled on this project before the runtime cutover is deployed**.

This account setting is deliberately a cutover gate. Do not point the live app at the new project until anonymous Host sign-in has been enabled and a real-device Host creation test succeeds.

Supabase recommends CAPTCHA/Turnstile for anonymous-sign-in abuse prevention. Add that protection before materially increasing public traffic.

## Security-advisor notes

Supabase may warn that the public Queuer RPCs are `SECURITY DEFINER` functions executable by `anon`/`authenticated`. This is intentional for this architecture: direct table access is denied, and these RPCs expose only narrow operations and limited projections. Ticket-specific operations require a random bearer `access_token`; queue discovery requires an unguessable public UUID or short join code.

The archived `letsq_legacy` tables can also appear in advisor output because they intentionally do not use RLS. They are not in the app access path: `anon` and `authenticated` have no schema/table privileges there.

Do not silence those warnings by granting anonymous table access.
