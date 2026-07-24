-- Let hosts keep a queue open without an artificial waiting-list limit.
-- target_orders is only a planning goal; it never stops Queuers from joining.

alter table public.queues
  drop constraint if exists queues_capacity_check;

alter table public.queues
  alter column capacity drop not null,
  alter column capacity drop default,
  add column if not exists target_orders integer check (target_orders is null or target_orders >= 1),
  add constraint queues_capacity_check check (capacity is null or capacity >= 1);

create or replace function public.join_queue(
  p_public_queue_id uuid,
  p_secret_code text,
  p_private_note text default null
)
returns table (ticket_number integer, access_token uuid, ticket_status public.ticket_status)
language plpgsql
security definer
set search_path = public, extensions
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
  if v_queue.capacity is not null and v_active_count >= v_queue.capacity then
    raise exception 'This queue is full.';
  end if;

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
