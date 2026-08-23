import { neon } from '@neondatabase/serverless';

export default async () => {
  if (!process.env.DATABASE_URL) return new Response('Database not configured', { status: 503 });
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql.query(`
    with deleted_tickets as (
      delete from letsq.tickets
       where closed_at < now() - interval '30 days'
       returning id
    ), deleted_queues as (
      delete from letsq.queues
       where status in ('closed', 'archived')
         and updated_at < now() - interval '30 days'
       returning id
    ), deleted_sessions as (
      delete from letsq.host_sessions
       where expires_at < now() or revoked_at < now() - interval '30 days'
       returning id
    ), deleted_limits as (
      delete from letsq.api_rate_limits where expires_at < now() returning key_hash
    )
    select
      (select count(*) from deleted_tickets)::integer as tickets,
      (select count(*) from deleted_queues)::integer as queues,
      (select count(*) from deleted_sessions)::integer as sessions,
      (select count(*) from deleted_limits)::integer as rate_limits
  `);
  return Response.json({ ok: true, deleted: rows[0] });
};

export const config = { schedule: '17 4 * * *' };

