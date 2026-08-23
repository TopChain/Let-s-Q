-- Structure for the archived Supabase prototype rows.
-- Row values are applied from a private one-time export and never committed.

create schema if not exists letsq_legacy;

create table if not exists letsq_legacy.queues (
  id uuid primary key,
  code text not null unique,
  host_token uuid not null,
  event_name text not null,
  store_name text not null,
  queue_name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  order_target integer,
  is_infinite boolean not null default false,
  status text not null check (status in ('open', 'closed')),
  next_ticket integer not null,
  now_serving integer not null,
  served integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists letsq_legacy.tickets (
  id uuid primary key,
  queue_id uuid not null references letsq_legacy.queues(id) on delete cascade,
  guest_token uuid not null,
  ticket_number integer not null,
  secret_code text not null,
  note text,
  color text,
  status text not null check (status in ('waiting', 'served', 'cancelled', 'no_show')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table letsq_legacy.queues enable row level security;
alter table letsq_legacy.tickets enable row level security;
revoke all on schema letsq_legacy from public;
revoke all on all tables in schema letsq_legacy from public;
