-- Run this migration once in the Supabase SQL Editor.
-- Public codes are short, case-insensitive, and never expose a Host identity.

alter table public.queues add column if not exists join_code text;

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

update public.queues
set join_code = public.generate_queue_join_code()
where join_code is null;

alter table public.queues
  alter column join_code set default public.generate_queue_join_code(),
  alter column join_code set not null;

create unique index if not exists queues_join_code_unique on public.queues (join_code);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'queues_join_code_format') then
    alter table public.queues add constraint queues_join_code_format check (join_code ~ '^Q[A-Z0-9]{5}$');
  end if;
end;
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

revoke all on function public.get_public_queue_by_code(text) from public;
grant execute on function public.get_public_queue_by_code(text) to anon, authenticated;
