-- Let’s Q production schema for Neon Postgres.
--
-- Only the Netlify Function connects with DATABASE_URL. The browser/mobile app
-- never receives database credentials, and no table is exposed directly.

create schema if not exists extensions;
create schema if not exists letsq;
create schema if not exists letsq_legacy;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type letsq.ticket_status as enum ('waiting', 'called', 'ready', 'hold', 'served', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists letsq.host_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  created_at timestamptz not null default now(),
  display_name text check (display_name is null or char_length(display_name) between 1 and 60)
);

create table if not exists letsq.host_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  host_id uuid not null references letsq.host_profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '400 days'),
  revoked_at timestamptz
);

create or replace function letsq.generate_queue_join_code()
returns text
language plpgsql
volatile
set search_path = letsq, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := 'Q' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1), '')
      from generate_series(1, 5)
    );
    exit when not exists (select 1 from letsq.queues where join_code = candidate);
  end loop;
  return candidate;
end;
$$;

create table if not exists letsq.queues (
  id uuid primary key default extensions.gen_random_uuid(),
  public_id uuid not null unique default extensions.gen_random_uuid(),
  join_code text not null unique default letsq.generate_queue_join_code() check (join_code ~ '^Q[A-Z0-9]{5}$'),
  owner_id uuid not null references letsq.host_profiles(id) on delete cascade,
  booth_name text not null check (char_length(booth_name) between 1 and 60),
  event_name text check (event_name is null or char_length(event_name) between 1 and 80),
  queue_name text not null check (char_length(queue_name) between 1 and 40),
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity >= 1),
  target_orders integer check (target_orders is null or target_orders >= 1),
  no_show_policy text not null default 'defer' check (no_show_policy in ('cancel', 'defer', 'hold')),
  hold_minutes integer not null default 5 check (hold_minutes between 1 and 30),
  next_ticket_number integer not null default 1,
  next_queue_order bigint not null default 1,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'archived')),
  accepting_entries boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists letsq.queue_staff (
  queue_id uuid not null references letsq.queues(id) on delete cascade,
  host_id uuid not null references letsq.host_profiles(id) on delete cascade,
  paired_at timestamptz not null default now(),
  primary key (queue_id, host_id)
);

create table if not exists letsq.tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  queue_id uuid not null references letsq.queues(id) on delete cascade,
  access_token uuid not null unique default extensions.gen_random_uuid(),
  ticket_number integer not null,
  queue_order bigint not null,
  secret_code_hash text not null,
  status letsq.ticket_status not null default 'waiting',
  no_show_attempts integer not null default 0 check (no_show_attempts >= 0),
  hold_until timestamptz,
  private_note text check (private_note is null or char_length(private_note) <= 60),
  called_at timestamptz,
  served_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (queue_id, ticket_number)
);

create table if not exists letsq.ratings (
  id uuid primary key default extensions.gen_random_uuid(),
  queue_id uuid not null references letsq.queues(id) on delete cascade,
  ticket_id uuid not null unique references letsq.tickets(id) on delete cascade,
  wait_score smallint not null check (wait_score between 1 and 5),
  service_score smallint not null check (service_score between 1 and 5),
  return_score smallint not null check (return_score between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists letsq.billing_entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  host_id uuid not null references letsq.host_profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  product_id text not null,
  status text not null check (status in ('active', 'grace_period', 'expired', 'revoked')),
  expires_at timestamptz,
  verified_at timestamptz not null default now(),
  unique (host_id, platform, product_id)
);

-- Only short-lived HMACs of connection metadata are stored. Raw IP addresses
-- and user-agent strings never enter the database.
create table if not exists letsq.api_rate_limits (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count >= 1),
  expires_at timestamptz not null,
  primary key (key_hash, action, window_start)
);

create index if not exists host_sessions_active_token on letsq.host_sessions(token_hash, expires_at) where revoked_at is null;
create index if not exists queues_owner_id on letsq.queues(owner_id);
create index if not exists queue_staff_host_id on letsq.queue_staff(host_id);
create index if not exists tickets_queue_active_order on letsq.tickets(queue_id, status, queue_order);
create index if not exists ratings_queue_id on letsq.ratings(queue_id);
create index if not exists rate_limits_expiry on letsq.api_rate_limits(expires_at);

create or replace function letsq.join_queue(
  p_public_queue_id uuid,
  p_secret_code text,
  p_private_note text default null
)
returns table (ticket_number integer, access_token uuid, ticket_status text)
language plpgsql
set search_path = letsq, extensions, pg_temp
as $$
declare
  v_queue letsq.queues%rowtype;
  v_active_count integer;
  v_ticket letsq.tickets%rowtype;
  v_code text := upper(trim(p_secret_code));
begin
  if v_code !~ '^[A-Z0-9]{3,12}$' then
    raise exception 'Choose a secret code with 3–12 letters or numbers.' using errcode = '22023';
  end if;
  if p_private_note is not null and char_length(trim(p_private_note)) > 60 then
    raise exception 'The optional request must be 60 characters or fewer.' using errcode = '22023';
  end if;

  select * into v_queue
  from letsq.queues
  where public_id = p_public_queue_id and status = 'open' and accepting_entries
  for update;
  if not found then raise exception 'This queue is unavailable.' using errcode = 'P0001'; end if;
  if v_queue.starts_at is not null and now() < v_queue.starts_at then
    raise exception 'This queue has not opened yet.' using errcode = 'P0001';
  end if;
  if v_queue.ends_at is not null and now() > v_queue.ends_at then
    raise exception 'Joining has closed.' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_active_count
  from letsq.tickets
  where queue_id = v_queue.id and status in ('waiting', 'called', 'ready', 'hold');
  if v_queue.capacity is not null and v_active_count >= v_queue.capacity then
    raise exception 'This queue is full.' using errcode = 'P0001';
  end if;

  insert into letsq.tickets (queue_id, ticket_number, queue_order, secret_code_hash, private_note)
  values (
    v_queue.id,
    v_queue.next_ticket_number,
    v_queue.next_queue_order,
    extensions.crypt(v_code, extensions.gen_salt('bf')),
    nullif(trim(p_private_note), '')
  )
  returning * into v_ticket;

  update letsq.queues
  set next_ticket_number = next_ticket_number + 1,
      next_queue_order = next_queue_order + 1,
      updated_at = now()
  where id = v_queue.id;

  return query select v_ticket.ticket_number, v_ticket.access_token, v_ticket.status::text;
end;
$$;

create or replace function letsq.get_ticket(p_access_token uuid)
returns table (
  ticket_number integer,
  status text,
  queue_name text,
  booth_name text,
  event_name text,
  ahead_count integer,
  now_serving integer,
  public_queue_id uuid,
  join_code text
)
language sql
stable
set search_path = letsq, pg_temp
as $$
  select
    t.ticket_number,
    case when t.status = 'hold' and t.hold_until <= now() then 'waiting' else t.status::text end,
    q.queue_name,
    q.booth_name,
    q.event_name,
    (select count(*)::integer
       from letsq.tickets ahead
      where ahead.queue_id = t.queue_id
        and ahead.status in ('waiting', 'called', 'ready', 'hold')
        and not (ahead.status = 'hold' and ahead.hold_until > now())
        and ahead.queue_order < t.queue_order),
    coalesce((select current.ticket_number
      from letsq.tickets current
      where current.queue_id = t.queue_id and current.status in ('called', 'ready')
      order by current.called_at desc nulls last, current.queue_order asc limit 1), 0),
    q.public_id,
    q.join_code
  from letsq.tickets t
  join letsq.queues q on q.id = t.queue_id
  where t.access_token = p_access_token;
$$;

create or replace function letsq.create_walk_in(
  p_host_id uuid,
  p_public_queue_id uuid,
  p_secret_code text
)
returns table (ticket_number integer, access_token uuid, ticket_status text)
language plpgsql
set search_path = letsq, extensions, pg_temp
as $$
declare
  v_queue letsq.queues%rowtype;
  v_ticket letsq.tickets%rowtype;
begin
  select * into v_queue
  from letsq.queues
  where public_id = p_public_queue_id and owner_id = p_host_id and status = 'open'
  for update;
  if not found then raise exception 'This Host queue is unavailable.' using errcode = 'P0001'; end if;

  insert into letsq.tickets (queue_id, ticket_number, queue_order, secret_code_hash, private_note)
  values (
    v_queue.id,
    v_queue.next_ticket_number,
    v_queue.next_queue_order,
    extensions.crypt(upper(trim(p_secret_code)), extensions.gen_salt('bf')),
    'Walk-in ticket'
  )
  returning * into v_ticket;

  update letsq.queues
  set next_ticket_number = next_ticket_number + 1,
      next_queue_order = next_queue_order + 1,
      updated_at = now()
  where id = v_queue.id;

  return query select v_ticket.ticket_number, v_ticket.access_token, v_ticket.status::text;
end;
$$;

create or replace function letsq.release_expired_holds(p_host_id uuid, p_queue_id uuid)
returns integer
language plpgsql
set search_path = letsq, pg_temp
as $$
declare v_count integer;
begin
  update letsq.tickets t
  set status = 'waiting', hold_until = null, called_at = null
  where t.queue_id = p_queue_id
    and t.status = 'hold'
    and t.hold_until <= now()
    and exists (select 1 from letsq.queues q where q.id = t.queue_id and q.owner_id = p_host_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function letsq.move_ticket(
  p_host_id uuid,
  p_queue_id uuid,
  p_ticket_id uuid,
  p_count_no_show boolean
)
returns text
language plpgsql
set search_path = letsq, pg_temp
as $$
declare
  v_queue letsq.queues%rowtype;
  v_ticket letsq.tickets%rowtype;
  v_attempts integer;
begin
  select * into v_queue from letsq.queues
  where id = p_queue_id and owner_id = p_host_id
  for update;
  if not found then raise exception 'This Host queue is unavailable.' using errcode = 'P0001'; end if;

  select * into v_ticket from letsq.tickets
  where id = p_ticket_id and queue_id = p_queue_id
    and status in ('waiting', 'called', 'ready', 'hold')
  for update;
  if not found then raise exception 'This ticket is unavailable.' using errcode = 'P0001'; end if;

  v_attempts := v_ticket.no_show_attempts + case when p_count_no_show then 1 else 0 end;
  if p_count_no_show and (v_queue.no_show_policy = 'cancel' or v_attempts >= 3) then
    update letsq.tickets
    set status = 'cancelled', no_show_attempts = v_attempts, private_note = null,
        hold_until = null, closed_at = now()
    where id = p_ticket_id;
    return 'cancelled';
  end if;

  if p_count_no_show and v_queue.no_show_policy = 'hold' then
    update letsq.tickets
    set status = 'hold', no_show_attempts = v_attempts,
        hold_until = now() + make_interval(mins => v_queue.hold_minutes), called_at = null
    where id = p_ticket_id;
    return 'hold';
  end if;

  update letsq.tickets
  set status = 'waiting', queue_order = v_queue.next_queue_order,
      no_show_attempts = v_attempts, called_at = null, hold_until = null
  where id = p_ticket_id;
  update letsq.queues
  set next_queue_order = next_queue_order + 1, updated_at = now()
  where id = p_queue_id;
  return 'waiting';
end;
$$;

create or replace function letsq.close_queue(p_host_id uuid, p_queue_id uuid)
returns void
language plpgsql
set search_path = letsq, pg_temp
as $$
begin
  perform 1 from letsq.queues
  where id = p_queue_id and owner_id = p_host_id
  for update;
  if not found then
    raise exception 'This Host queue is unavailable.' using errcode = 'P0001';
  end if;
  update letsq.queues
  set status = 'closed', accepting_entries = false, updated_at = now()
  where id = p_queue_id and owner_id = p_host_id;
  update letsq.tickets
  set status = 'cancelled', private_note = null, hold_until = null, closed_at = now()
  where queue_id = p_queue_id and status in ('waiting', 'called', 'ready', 'hold');
end;
$$;

create or replace function letsq.consume_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = letsq, pg_temp
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then return false; end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into letsq.api_rate_limits (key_hash, action, window_start, request_count, expires_at)
  values (p_key_hash, p_action, v_window, 1, v_window + make_interval(secs => p_window_seconds * 2))
  on conflict (key_hash, action, window_start)
  do update set request_count = letsq.api_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

-- Defense in depth: if Neon Data API is enabled later, these tables remain
-- blocked because RLS is enabled and no client policies exist.
alter table letsq.host_profiles enable row level security;
alter table letsq.host_sessions enable row level security;
alter table letsq.queues enable row level security;
alter table letsq.queue_staff enable row level security;
alter table letsq.tickets enable row level security;
alter table letsq.ratings enable row level security;
alter table letsq.billing_entitlements enable row level security;
alter table letsq.api_rate_limits enable row level security;

revoke all on schema letsq from public;
revoke all on all tables in schema letsq from public;
revoke all on all functions in schema letsq from public;
alter default privileges in schema letsq revoke all on tables from public;
alter default privileges in schema letsq revoke all on functions from public;
