-- Run this migration once in an existing Let’s Q Supabase project.
-- It exposes only public queue details needed after a QR scan and lets a
-- Queuer holding the random ticket token cancel their own active ticket.

alter table public.tickets add column if not exists hold_until timestamptz;

create or replace function public.get_public_queue(p_public_queue_id uuid)
returns table (
  public_id uuid,
  booth_name text,
  queue_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  no_show_policy text,
  status text,
  active_count integer,
  now_serving integer
)
language sql
security definer
set search_path = public
as $$
  select q.public_id, q.booth_name, q.queue_name, q.starts_at, q.ends_at,
    q.capacity, q.no_show_policy, q.status,
    count(t.id) filter (where t.status in ('waiting', 'called', 'ready', 'hold'))::integer,
    coalesce((select current.ticket_number from public.tickets current
      where current.queue_id = q.id and current.status in ('called', 'ready')
      order by current.called_at desc nulls last, current.queue_order asc limit 1), 0)
  from public.queues q
  left join public.tickets t on t.queue_id = q.id
  where q.public_id = p_public_queue_id and q.status in ('open', 'closed')
  group by q.id;
$$;

revoke all on function public.get_public_queue(uuid) from public;
grant execute on function public.get_public_queue(uuid) to anon, authenticated;

create or replace function public.cancel_my_ticket(p_access_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets
  set status = 'cancelled', private_note = null, hold_until = null, closed_at = now()
  where access_token = p_access_token and status in ('waiting', 'called', 'ready', 'hold');
  if not found then raise exception 'This ticket cannot be cancelled.'; end if;
end;
$$;

revoke all on function public.cancel_my_ticket(uuid) from public;
grant execute on function public.cancel_my_ticket(uuid) to anon, authenticated;
