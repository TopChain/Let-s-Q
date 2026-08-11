-- The Host UPDATE must pass RLS before an unexpired hold becomes intentionally
-- invisible to the Host waiting-list query. Apply the policy after that update
-- in a SECURITY DEFINER trigger rather than mutating the row in BEFORE UPDATE.
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
    return null;
  end if;

  select q.no_show_policy, q.hold_minutes
    into v_policy, v_hold_minutes
  from public.queues q
  where q.id = new.queue_id;

  if v_policy = 'cancel' or new.no_show_attempts >= 3 then
    update public.tickets
    set status = 'cancelled',
        private_note = null,
        hold_until = null,
        closed_at = now(),
        called_at = null
    where id = new.id;
    return null;
  end if;

  if v_policy = 'hold' then
    update public.tickets
    set status = 'hold',
        hold_until = now() + make_interval(mins => greatest(1, least(30, coalesce(v_hold_minutes, 5)))),
        called_at = null
    where id = new.id;
    return null;
  end if;

  update public.tickets
  set status = 'waiting',
      hold_until = null,
      called_at = null
  where id = new.id;
  return null;
end;
$$;

drop trigger if exists tickets_apply_no_show_policy on public.tickets;
create trigger tickets_apply_no_show_policy
after update of no_show_attempts on public.tickets
for each row
when (new.no_show_attempts > old.no_show_attempts)
execute function public.apply_ticket_no_show_policy();
