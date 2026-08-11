-- JavaScript sends JSON numbers. Use integer RPC parameters and validate/cast
-- internally instead of exposing a smallint-specific function signature.

drop function if exists public.submit_anonymous_rating(uuid, smallint, smallint, smallint);

create function public.submit_anonymous_rating(
  p_access_token uuid,
  p_wait_score integer,
  p_service_score integer,
  p_return_score integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ticket public.tickets;
begin
  if p_wait_score not between 1 and 5
     or p_service_score not between 1 and 5
     or p_return_score not between 1 and 5 then
    raise exception 'Ratings must be between 1 and 5.';
  end if;

  select * into v_ticket
  from public.tickets
  where access_token = p_access_token;

  if not found or v_ticket.status <> 'served' then
    raise exception 'This ticket cannot be rated.';
  end if;

  insert into public.ratings (queue_id, ticket_id, wait_score, service_score, return_score)
  values (
    v_ticket.queue_id,
    v_ticket.id,
    p_wait_score::smallint,
    p_service_score::smallint,
    p_return_score::smallint
  );
end;
$$;

revoke all on function public.submit_anonymous_rating(uuid, integer, integer, integer) from public;
grant execute on function public.submit_anonymous_rating(uuid, integer, integer, integer)
  to anon, authenticated, service_role;
