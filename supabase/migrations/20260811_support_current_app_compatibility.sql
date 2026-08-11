-- Compatibility fields used by the current Host/Queuer UI while Supabase is the single backend.
alter table public.queues
  add column if not exists event_name text check (event_name is null or char_length(event_name) between 1 and 80),
  add column if not exists accepting_entries boolean not null default true;

create or replace function public.join_queue(
  p_public_queue_id uuid,
  p_secret_code text,
  p_private_note text default null
)
returns table (ticket_number integer, access_token uuid, ticket_status public.ticket_status)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_queue public.queues;
  v_active_count integer;
  v_ticket public.tickets;
  v_code text := upper(trim(p_secret_code));
begin
  if v_code !~ '^[A-Z0-9]{3,12}$' then
    raise exception 'Choose a secret code with 3–12 letters or numbers.';
  end if;
  if p_private_note is not null and char_length(p_private_note) > 60 then
    raise exception 'The optional request is too long.';
  end if;

  select * into v_queue
  from public.queues
  where public_id = p_public_queue_id and status = 'open'
  for update;

  if not found then raise exception 'This queue is unavailable.'; end if;
  if not v_queue.accepting_entries then raise exception 'This queue is temporarily paused.'; end if;
  if v_queue.starts_at is not null and now() < v_queue.starts_at then raise exception 'This queue has not opened yet.'; end if;
  if v_queue.ends_at is not null and now() > v_queue.ends_at then raise exception 'Joining has closed.'; end if;

  if v_queue.capacity is not null then
    select count(*) into v_active_count
    from public.tickets
    where queue_id = v_queue.id
      and status in ('waiting', 'called', 'ready', 'hold');
    if v_active_count >= v_queue.capacity then raise exception 'This queue is full.'; end if;
  end if;

  insert into public.tickets (queue_id, ticket_number, queue_order, secret_code_hash, private_note)
  values (v_queue.id, v_queue.next_ticket_number, v_queue.next_queue_order,
          extensions.crypt(v_code, extensions.gen_salt('bf')), nullif(trim(p_private_note), ''))
  returning * into v_ticket;

  update public.queues
  set next_ticket_number = next_ticket_number + 1,
      next_queue_order = next_queue_order + 1,
      updated_at = now()
  where id = v_queue.id;

  return query select v_ticket.ticket_number, v_ticket.access_token, v_ticket.status;
end;
$$;

drop function if exists public.get_public_queue_by_code(text);
drop function if exists public.get_public_queue(uuid);

create function public.get_public_queue(p_public_queue_id uuid)
returns table (
  public_id uuid,
  booth_name text,
  event_name text,
  queue_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  no_show_policy text,
  status text,
  accepting_entries boolean,
  active_count integer,
  now_serving integer,
  join_code text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select q.public_id, q.booth_name, q.event_name, q.queue_name, q.starts_at, q.ends_at,
    q.capacity, q.no_show_policy, q.status, q.accepting_entries,
    count(t.id) filter (where t.status in ('waiting', 'called', 'ready', 'hold'))::integer,
    coalesce((select current.ticket_number from public.tickets current
      where current.queue_id = q.id and current.status in ('called', 'ready')
      order by current.called_at desc nulls last, current.queue_order asc limit 1), 0),
    q.join_code
  from public.queues q
  left join public.tickets t on t.queue_id = q.id
  where q.public_id = p_public_queue_id and q.status in ('open', 'closed')
  group by q.id;
$$;

create function public.get_public_queue_by_code(p_join_code text)
returns table (
  public_id uuid,
  booth_name text,
  event_name text,
  queue_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  no_show_policy text,
  status text,
  accepting_entries boolean,
  active_count integer,
  now_serving integer,
  join_code text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select *
  from public.get_public_queue((
    select q.public_id
    from public.queues q
    where q.join_code = upper(regexp_replace(trim(p_join_code), '[^A-Za-z0-9]', '', 'g'))
    limit 1
  ));
$$;

drop function if exists public.get_my_ticket(uuid);
create function public.get_my_ticket(p_access_token uuid)
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
       and ahead.status in ('waiting', 'called', 'ready', 'hold')
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

revoke all on function public.join_queue(uuid, text, text) from public;
revoke all on function public.get_public_queue(uuid) from public;
revoke all on function public.get_public_queue_by_code(text) from public;
revoke all on function public.get_my_ticket(uuid) from public;

grant execute on function public.join_queue(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.get_public_queue(uuid) to anon, authenticated, service_role;
grant execute on function public.get_public_queue_by_code(text) to anon, authenticated, service_role;
grant execute on function public.get_my_ticket(uuid) to anon, authenticated, service_role;
