# Let’s Q product guardrails

## Core idea

Let’s Q exists to make a physical line optional.

**Host:** create a queue → share a QR/short code → manage the line.

**Queuer:** scan or enter the code → get a number → wait anywhere → check live status.

This flow is the product. New features must make it faster, clearer, safer, or more reliable; they must not turn Let’s Q into an account-heavy reservation, CRM, social, or advertising app.

## Production backend record

The production data store is the existing **Let’s Q** Neon project, accessed only through the Netlify API. The previous Supabase Let’s Q project is a temporary migration/rollback source and must not be treated as production after the Neon smoke test passes.

Do not retire Supabase until the Neon schema and archive import, Netlify secrets/deploy, and a live queue smoke test are verified.

## Non-negotiables

1. **No account required for Queuers.** Do not require a name, phone number, email address, social account, or location to take a number.
2. **Fast join.** A healthy queue must remain joinable even when analytics, ads, ratings, photos, or optional features fail.
3. **Privacy by design.** Queue operations should use anonymous ticket state and minimum necessary data. Secret codes must never be stored in plain text.
4. **One simple app, two roles.** Host and Queuer experiences may differ, but they belong to the same Let’s Q system and must interoperate across supported platforms.
5. **Queue truth lives on the backend.** Ticket number, order, status, capacity, no-show behavior, and authorization must be enforced server-side, not trusted to browser/mobile state.
6. **Ads never control queue access.** An ad failure must never prevent scanning, joining, cancelling a ticket, checking status, or a Host calling/serving a Queuer. Ads must never imitate Let’s Q controls.
7. **Graceful failure.** Repeated taps, reconnects, stale screens, app restarts, and concurrent users must not create duplicate ticket numbers or corrupt queue order.
8. **Keep the interface legible under pressure.** The next operational action should be obvious to a Host; a Queuer should always understand their number and current state.

## Scale baseline

Treat **100 simultaneous Hosts and 10,000 simultaneous Queuers** as a baseline design exercise, not a promise of measured production capacity. Changes touching joins, polling/realtime updates, queue ordering, analytics, or ads should be reviewed against that scenario.

Critical invariants:

- ticket numbers are unique within a queue;
- queue order remains deterministic;
- one Queuer cannot change another ticket;
- only authorized Hosts manage their queues;
- retries do not double-create a ticket silently;
- closed/expired queues reject new joins;
- optional monetization never becomes a dependency of core queue operations.

## Product decision test

Before merging a feature, ask:

> Does this help someone **create a line, take a number, wait somewhere better, or run the line more reliably**?

If not, it needs a strong reason to exist.
