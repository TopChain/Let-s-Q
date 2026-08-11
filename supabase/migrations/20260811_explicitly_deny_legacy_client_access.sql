-- The archived prototype rows are retained only for disaster recovery/history.
-- Keep RLS enabled and make the no-client-access intent explicit so advisors
-- do not report these tables as RLS-with-no-policy.

drop policy if exists "No client access to archived queues" on letsq_legacy.queues;
create policy "No client access to archived queues"
on letsq_legacy.queues for all to anon, authenticated
using (false)
with check (false);

drop policy if exists "No client access to archived tickets" on letsq_legacy.tickets;
create policy "No client access to archived tickets"
on letsq_legacy.tickets for all to anon, authenticated
using (false)
with check (false);
