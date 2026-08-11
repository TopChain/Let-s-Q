-- Adopt Supabase's explicit Data API exposure model.
-- New tables/functions should not become reachable merely because they are in public.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- Remove broad inherited/default grants from the current app tables.
revoke all on table public.host_profiles from anon, authenticated;
revoke all on table public.queues from anon, authenticated;
revoke all on table public.queue_staff from anon, authenticated;
revoke all on table public.tickets from anon, authenticated;
revoke all on table public.ratings from anon, authenticated;
revoke all on table public.billing_entitlements from anon, authenticated;

-- Signed-in Host devices get only the table privileges used by the app.
grant select, insert, update on table public.host_profiles to authenticated;
grant select, insert, update, delete on table public.queues to authenticated;
grant select, insert, update, delete on table public.queue_staff to authenticated;
grant select, update on table public.tickets to authenticated;
grant select on table public.ratings to authenticated;
grant select on table public.billing_entitlements to authenticated;

-- Server-side administrative access remains explicit.
grant all on table public.host_profiles, public.queues, public.queue_staff,
  public.tickets, public.ratings, public.billing_entitlements to service_role;

-- PostgreSQL grants EXECUTE to PUBLIC on functions by default. Close that surface,
-- then re-open only the narrow RPCs the app intentionally exposes.
revoke all on function public.generate_queue_join_code() from public, anon;
revoke all on function public.join_queue(uuid, text, text) from public;
revoke all on function public.get_my_ticket(uuid) from public;
revoke all on function public.get_public_queue(uuid) from public;
revoke all on function public.get_public_queue_by_code(text) from public;
revoke all on function public.cancel_my_ticket(uuid) from public;
revoke all on function public.submit_anonymous_rating(uuid, smallint, smallint, smallint) from public;

grant execute on function public.generate_queue_join_code() to authenticated, service_role;
grant execute on function public.join_queue(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.get_my_ticket(uuid) to anon, authenticated, service_role;
grant execute on function public.get_public_queue(uuid) to anon, authenticated, service_role;
grant execute on function public.get_public_queue_by_code(text) to anon, authenticated, service_role;
grant execute on function public.cancel_my_ticket(uuid) to anon, authenticated, service_role;
grant execute on function public.submit_anonymous_rating(uuid, smallint, smallint, smallint) to anon, authenticated, service_role;
