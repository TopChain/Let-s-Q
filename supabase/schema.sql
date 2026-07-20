-- Let’s Q production data model for Supabase/Postgres.
-- Apply this only inside a new Supabase project. It keeps queuers anonymous
-- while giving authenticated Hosts secure access to their own queues.

-- Supabase installs extensions in the dedicated `extensions` schema. Keeping
-- pgcrypto there avoids exposing its functions through the public schema.
create extension if not exists pgcrypto with schema extensions;

create type public.ticket_status as enum ('waiting', 'called', 'ready', 'hold', 'served', 'cancelled');

create table public.host_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text check (char_length(display_name) between 1 and 60)
);

create table public.queues (
  id uuid primary key default extensions.gen_random_uuid(),
  public_id uuid not null unique default extensions.gen_random_uuid(),
  join_code text not null unique check (join_code ~ '^Q[A-Z0-9]{5}$'),
  owner_id uuid not null references public.host_profiles(id) on delete cascade,
  booth_name text not null check (char_length(booth_name) between 1 and 60),
  queue_name text not null check (char_length(queue_name) between 1 and 40),
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer not null default 8 check (capacity between 1 and 100),
  no_show_policy text not null default 'defer' check (no_show_policy in ('cancel', 'defer', 'hold')),
  hold_minutes integer not null default 5 check (hold_minutes between 1 and 30),
  next_ticket_number integer not null default 1,
  next_queue_order bigint not null default 1,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.generate_queue_join_code()
returns text
language plpgsql
volatile
set search_path = public
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
    exit when not exists (select 1 from public.queues where join_code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.queues alter column join_code set default public.generate_queue_join_code();

create table public.queue_staff (
  queue_id uuid not null references public.queues(id) on delete cascade,
  host_id uuid not null references public.host_profiles(id) on delete cascade,
  paired_at timestamptz not null default now(),
  primary key (queue_id, host_id)
);

create table public.tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete cascade,
  access_token uuid not null unique default extensions.gen_random_uuid(),
  ticket_number integer not null,
  queue_order bigint not null,
  secret_code_hash text not null,
  status public.ticket_status not null default 'waiting',
  no_show_attempts integer not null default 0 check (no_show_attempts >= 0),
  hold_until timestamptz,
  private_note text check (char_length(private_note) <= 60),
  called_at timestamptz,
  served_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (queue_id, ticket_number)
);

create table public.ratings (
  id uuid primary key default extensions.gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete cascade,
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  wait_score smallint not null check (wait_score between 1 and 5),
  service_score smallint not null check (service_score between 1 and 5),
  return_score smallint not null check (return_score between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.billing_entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  host_id uuid not null references public.host_profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  product_id text not null,
  status text not null check (status in ('active', 'grace_period', 'expired', 'revoked')),
  expires_at timestamptz,
  verified_at timestamptz not null default now(),
  unique (host_id, platform, product_id)
);

create index tickets_queue_active_order on public.tickets(queue_id, status, queue_order);
create index ratings_queue_id on public.ratings(queue_id);

alter table public.host_profiles enable row level security;
alter table public.queues enable row level security;
alter table public.queue_staff enable row level security;
alter table public.tickets enable row level security;
alter table public.ratings enable row level security;
alter table public.billing_entitlements enable row level security;

create policy "Hosts can read their own profile"
on public.host_profiles for select using (id = auth.uid());
create policy "Hosts can create their own profile"
on public.host_profiles for insert with check (id = auth.uid());
create policy "Hosts can update their own profile"
on public.host_profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Hosts can manage owned queues"
on public.queues for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Hosts can manage staff on their queues"
on public.queue_staff for all using (
  exists (select 1 from public.queues q where q.id = queue_id and q.owner_id = auth.uid())
) with check (
  exists (select 1 from public.queues q where q.id = queue_id and q.owner_id = auth.uid())
);

create policy "Hosts can read tickets for their queues"
on public.tickets for select using (
  exists (select 1 from public.queues q where q.id = queue_id and q.owner_id = auth.uid())
);
create policy "Hosts can update tickets for their queues"
on public.tickets for update using (
  exists (select 1 from public.queues q where q.id = queue_id and q.owner_id = auth.uid())
) with check (
  exists (select 1 from public.queues q where q.id = queue_id and q.owner_id = auth.uid())
);

create policy "Hosts can read aggregate rating rows for their queues"
on public.ratings for select using (
  exists (select 1 from public.queues q where q.id = queue_id and q.owner_id = auth.uid())
);
create policy "Hosts can read their own verified entitlement"
on public.billing_entitlements for select using (host_id = auth.uid());

-- A public join creates a ticket with a random access token. The token, not
-- the human-chosen short code, authorizes later ticket-status requests.
create or replace function public.join_queue(
  p_public_queue_id uuid,
  p_secret_code text,
  p_private_note text default null
)
returns table (ticket_number integer, access_token uuid, ticket_status public.ticket_status)
language plpgsql
security definer
set search_path = public
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

  select * into v_queue from public.queues
  where public_id = p_public_queue_id and status = 'open'
  for update;
  if not found then raise exception 'This queue is unavailable.'; end if;
  if v_queue.starts_at is not null and now() < v_queue.starts_at then raise exception 'This queue has not opened yet.'; end if;
  if v_queue.ends_at is not null and now() > v_queue.ends_at then raise exception 'Joining has closed.'; end if;

  select count(*) into v_active_count from public.tickets
  where queue_id = v_queue.id and status in ('waiting', 'called', 'ready', 'hold');
  if v_active_count >= v_queue.capacity then raise exception 'This queue is full.'; end if;

  insert into public.tickets (queue_id, ticket_number, queue_order, secret_code_hash, private_note)
  values (v_queue.id, v_queue.next_ticket_number, v_queue.next_queue_order, extensions.crypt(v_code, extensions.gen_salt('bf')), nullif(trim(p_private_note), ''))
  returning * into v_ticket;

  update public.queues set
    next_ticket_number = next_ticket_number + 1,
    next_queue_order = next_queue_order + 1,
    updated_at = now()
  where id = v_queue.id;

  return query select v_ticket.ticket_number, v_ticket.access_token, v_ticket.status;
end;
$$;

create or replace function public.get_my_ticket(p_access_token uuid)
returns table (ticket_number integer, status public.ticket_status, queue_name text, booth_name text, ahead_count integer)
language sql
security definer
set search_path = public
as $$
  select t.ticket_number, t.status, q.queue_name, q.booth_name,
    (select count(*)::integer from public.tickets ahead
     where ahead.queue_id = t.queue_id
       and ahead.status in ('waiting', 'called', 'ready', 'hold')
       and ahead.queue_order < t.queue_order) as ahead_count
  from public.tickets t
  join public.queues q on q.id = t.queue_id
  where t.access_token = p_access_token;
$$;

-- Gives a Queuer only the information needed to decide whether a public queue
-- can be joined. It deliberately excludes the Host identity, ticket codes,
-- notes, and individual ticket records.
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

create or replace function public.get_public_queue_by_code(p_join_code text)
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
  select *
  from public.get_public_queue((
    select q.public_id
    from public.queues q
    where q.join_code = upper(regexp_replace(trim(p_join_code), '[^A-Za-z0-9]', '', 'g'))
    limit 1
  ));
$$;

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

create or replace function public.submit_anonymous_rating(
  p_access_token uuid,
  p_wait_score smallint,
  p_service_score smallint,
  p_return_score smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where access_token = p_access_token;
  if not found or v_ticket.status <> 'served' then raise exception 'This ticket cannot be rated.'; end if;
  insert into public.ratings (queue_id, ticket_id, wait_score, service_score, return_score)
  values (v_ticket.queue_id, v_ticket.id, p_wait_score, p_service_score, p_return_score);
end;
$$;

revoke all on function public.join_queue(uuid, text, text) from public;
revoke all on function public.get_my_ticket(uuid) from public;
revoke all on function public.get_public_queue(uuid) from public;
revoke all on function public.get_public_queue_by_code(text) from public;
revoke all on function public.cancel_my_ticket(uuid) from public;
revoke all on function public.submit_anonymous_rating(uuid, smallint, smallint, smallint) from public;
grant execute on function public.join_queue(uuid, text, text) to anon, authenticated;
grant execute on function public.get_my_ticket(uuid) to anon, authenticated;
grant execute on function public.get_public_queue(uuid) to anon, authenticated;
grant execute on function public.get_public_queue_by_code(text) to anon, authenticated;
grant execute on function public.cancel_my_ticket(uuid) to anon, authenticated;
grant execute on function public.submit_anonymous_rating(uuid, smallint, smallint, smallint) to anon, authenticated;
