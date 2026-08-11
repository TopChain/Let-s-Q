-- Enforce the Host-selected no-show policy centrally so every client behaves the same.
create or replace function public.apply_ticket_no_show_policy()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_policy text;
  v_hold_minutes integer;
begin
  if new.no_show_attempts <= old.no_show_attempts then
    return new;
  end if;

  select q.no_show_policy, q.hold_minutes
    into v_policy, v_hold_minutes
  from public.queues q
  where q.id = new.queue_id;

  if v_policy = 'cancel' then
    new.status := 'cancelled';
    new.private_note := null;
    new.hold_until := null;
    new.closed_at := now();
    new.called_at := null;
    return new;
  end if;

  if new.no_show_attempts >= 3 then
    new.status := 'cancelled';
    new.private_note := null;
    new.hold_until := null;
    new.closed_at := now();
    new.called_at := null;
    return new;
  end if;

  if v_policy = 'hold' then
    new.status := 'hold';
    new.hold_until := now() + make_interval(mins => greatest(1, least(30, coalesce(v_hold_minutes, 5))));
    new.called_at := null;
    return new;
  end if;

  -- The defer policy keeps the client-requested move-to-back ordering.
  new.status := 'waiting';
  new.hold_until := null;
  new.called_at := null;
  return new;
end;
$$;

drop trigger if exists tickets_apply_no_show_policy on public.tickets;
create trigger tickets_apply_no_show_policy
before update of no_show_attempts on public.tickets
for each row
when (new.no_show_attempts > old.no_show_attempts)
execute function public.apply_ticket_no_show_policy();

-- The current Host UI has no dedicated Hold lane. Hide unexpired held tickets
-- from the Host waiting list; they automatically become visible after hold_until.
drop policy if exists "Hosts can read tickets for their queues" on public.tickets;
create policy "Hosts can read tickets for their queues"
on public.tickets for select to authenticated
using (
  exists (
    select 1 from public.queues q
    where q.id = queue_id and q.owner_id = (select auth.uid())
  )
  and (
    status <> 'hold'
    or hold_until is null
    or hold_until <= now()
  )
);

-- Closing a queue must close every active ticket, including a ticket currently
-- hidden from the Host list because it is on hold.
create or replace function public.close_active_tickets_with_queue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    update public.tickets
    set status = 'cancelled',
        private_note = null,
        hold_until = null,
        closed_at = coalesce(closed_at, now())
    where queue_id = new.id
      and status in ('waiting', 'called', 'ready', 'hold');
  end if;
  return new;
end;
$$;

drop trigger if exists queues_close_active_tickets on public.queues;
create trigger queues_close_active_tickets
after update of status on public.queues
for each row
execute function public.close_active_tickets_with_queue();

-- A held ticket should not count as being ahead of another Queuer until its hold expires.
create or replace function public.get_my_ticket(p_access_token uuid)
returns table (
  ticket_number integer,
  status public.ticket_status,
  queue_name text,
  booth_name text,
  event_name text,
  ahead_count integer,
  now_serving integer,
  public_queue_id uuid,
  join_code text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select t.ticket_number, t.status, q.queue_name, q.booth_name, q.event_name,
    (select count(*)::integer from public.tickets ahead
     where ahead.queue_id = t.queue_id
       and (
         ahead.status in ('waiting', 'called', 'ready')
         or (ahead.status = 'hold' and (ahead.hold_until is null or ahead.hold_until <= now()))
       )
       and ahead.queue_order < t.queue_order) as ahead_count,
    coalesce((select current.ticket_number from public.tickets current
      where current.queue_id = t.queue_id and current.status in ('called', 'ready')
      order by current.called_at desc nulls last, current.queue_order asc limit 1), 0) as now_serving,
    q.public_id,
    q.join_code
  from public.tickets t
  join public.queues q on q.id = t.queue_id
  where t.access_token = p_access_token;
$$;

revoke all on function public.apply_ticket_no_show_policy() from public, anon, authenticated;
revoke all on function public.close_active_tickets_with_queue() from public, anon, authenticated;
revoke all on function public.get_my_ticket(uuid) from public;
grant execute on function public.get_my_ticket(uuid) to anon, authenticated, service_role;
