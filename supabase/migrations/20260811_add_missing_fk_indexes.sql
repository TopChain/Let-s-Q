-- Cover foreign keys used by Host ownership/staff lookups.
create index if not exists queues_owner_id_idx on public.queues(owner_id);
create index if not exists queue_staff_host_id_idx on public.queue_staff(host_id);
