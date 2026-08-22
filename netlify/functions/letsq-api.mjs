import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  vary: 'origin'
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const JOIN_CODE_PATTERN = /^Q[A-Z0-9]{5}$/;
const ACTIVE_TICKET_STATUSES = ['waiting', 'called', 'ready', 'hold'];

let sqlClient = null;

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error('The queue database is not configured.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }
  sqlClient ||= neon(connectionString);
  return sqlClient;
}

function json(statusCode, value, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(value)
  };
}

function ok(data, statusCode = 200) {
  return json(statusCode, { ok: true, data });
}

function fail(statusCode, error, code) {
  return json(statusCode, { ok: false, error, code });
}

function parseBody(event) {
  if (!event?.body) return {};
  const source = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (Buffer.byteLength(source, 'utf8') > 32_000) {
    const error = new Error('The request is too large.');
    error.status = 413;
    error.code = 'REQUEST_TOO_LARGE';
    throw error;
  }
  let parsed;
  try { parsed = JSON.parse(source); } catch {
    const error = new Error('The request body is not valid JSON.');
    error.status = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error('The request body is invalid.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return parsed;
}

function bearerToken(headers = {}) {
  const header = headers.authorization || headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim() || null;
  return token && HOST_TOKEN_PATTERN.test(token) ? token : null;
}

function requireObject(value, label = 'payload') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error(`The ${label} is invalid.`);
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return value;
}

function requiredString(value, label, maxLength) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} is required and must be ${maxLength} characters or fewer.`);
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return text;
}

function optionalString(value, maxLength) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (text.length > maxLength) {
    const error = new Error(`This value must be ${maxLength} characters or fewer.`);
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return text || null;
}

function uuid(value, label) {
  const text = String(value || '').trim();
  if (!UUID_PATTERN.test(text)) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return text;
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error('The queue date or time is invalid.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return date.toISOString();
}

function optionalPositiveInteger(value, max = 1_000_000) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    const error = new Error('This number is outside the allowed range.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  return number;
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function requestFingerprint(event, subject = '') {
  const secret = process.env.RATE_LIMIT_SECRET || (process.env.CONTEXT === 'production' ? '' : 'letsq-local-development');
  if (!secret) {
    const error = new Error('The queue abuse-protection secret is not configured.');
    error.code = 'RATE_LIMIT_NOT_CONFIGURED';
    throw error;
  }
  const headers = event.headers || {};
  const address = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const agent = String(headers['user-agent'] || '').slice(0, 160);
  return createHmac('sha256', secret).update(`${subject}|${address}|${agent}`).digest('hex');
}

async function enforceRateLimit(db, event, action, limit, windowSeconds, subject = '') {
  const key = requestFingerprint(event, subject);
  const rows = await db.query(
    'select letsq.consume_rate_limit($1::text, $2::text, $3::integer, $4::integer) as allowed',
    [key, action, limit, windowSeconds]
  );
  if (!firstRow(rows)?.allowed) {
    const error = new Error('Too many attempts. Please wait a moment and try again.');
    error.status = 429;
    error.code = 'RATE_LIMITED';
    throw error;
  }
}

async function authenticateHost(db, token) {
  if (!token) return null;
  const rows = await db.query(
    `with valid as (
       select id, host_id, last_seen_at
         from letsq.host_sessions
        where token_hash = $1::text
          and revoked_at is null
          and expires_at > now()
     ), touched as (
       update letsq.host_sessions session
          set last_seen_at = now(), expires_at = now() + interval '400 days'
         from valid
        where session.id = valid.id
          and valid.last_seen_at < now() - interval '1 day'
       returning session.id
     )
     select host_id from valid`,
    [tokenHash(token)]
  );
  return firstRow(rows)?.host_id || null;
}

async function requireHost(db, event) {
  const token = bearerToken(event.headers);
  const hostId = await authenticateHost(db, token);
  if (!hostId) {
    const error = new Error('This Host session is no longer valid.');
    error.status = 401;
    error.code = 'HOST_SESSION_INVALID';
    throw error;
  }
  return hostId;
}

async function ensureHost(db, event) {
  const token = bearerToken(event.headers);
  if (token) {
    const hostId = await authenticateHost(db, token);
    if (!hostId) {
      const error = new Error('This Host session is no longer valid.');
      error.status = 401;
      error.code = 'HOST_SESSION_INVALID';
      throw error;
    }
    return { hostId };
  }

  await enforceRateLimit(db, event, 'ensure-host', 10, 3600);
  const hostToken = randomBytes(32).toString('base64url');
  const rows = await db.query(
    `with host as (
       insert into letsq.host_profiles default values returning id
     )
     insert into letsq.host_sessions (host_id, token_hash)
     select id, $1::text from host
     returning host_id`,
    [tokenHash(hostToken)]
  );
  return { hostId: firstRow(rows).host_id, hostToken };
}

async function createQueue(db, event, payload) {
  const hostId = await requireHost(db, event);
  const boothName = requiredString(payload.booth_name, 'Booth or event name', 60);
  const eventName = optionalString(payload.event_name, 80) || boothName;
  const queueName = requiredString(payload.queue_name, 'Queue name', 40);
  const startsAt = optionalDate(payload.starts_at);
  const endsAt = optionalDate(payload.ends_at);
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    const error = new Error('The end time must be after the start time.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  const targetOrders = optionalPositiveInteger(payload.target_orders);
  const policy = ['cancel', 'defer', 'hold'].includes(payload.no_show_policy) ? payload.no_show_policy : 'defer';
  const rows = await db.query(
    `insert into letsq.queues
       (owner_id, booth_name, event_name, queue_name, starts_at, ends_at, capacity,
        target_orders, no_show_policy, status, accepting_entries)
     values ($1::uuid, $2::text, $3::text, $4::text, $5::timestamptz, $6::timestamptz,
             null, $7::integer, $8::text, 'open', true)
     returning *`,
    [hostId, boothName, eventName, queueName, startsAt, endsAt, targetOrders, policy]
  );
  return firstRow(rows);
}

async function updateQueue(db, event, payload) {
  const hostId = await requireHost(db, event);
  const queueId = uuid(payload.queueId, 'Queue ID');
  const changes = requireObject(payload.changes, 'queue changes');
  const hasEvent = Object.hasOwn(changes, 'event_name');
  const hasBooth = Object.hasOwn(changes, 'booth_name');
  const hasName = Object.hasOwn(changes, 'queue_name');
  const hasStart = Object.hasOwn(changes, 'starts_at');
  const hasEnd = Object.hasOwn(changes, 'ends_at');
  const hasStatus = Object.hasOwn(changes, 'status');
  const hasAccepting = Object.hasOwn(changes, 'accepting_entries');
  const eventName = hasEvent ? requiredString(changes.event_name, 'Event name', 80) : null;
  const boothName = hasBooth ? requiredString(changes.booth_name, 'Booth name', 60) : null;
  const queueName = hasName ? requiredString(changes.queue_name, 'Queue name', 40) : null;
  const startsAt = hasStart ? optionalDate(changes.starts_at) : null;
  const endsAt = hasEnd ? optionalDate(changes.ends_at) : null;
  const status = hasStatus && ['draft', 'open'].includes(changes.status) ? changes.status : null;
  if (hasStatus && !status) {
    const error = new Error('Queue status is invalid.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  const rows = await db.query(
    `update letsq.queues
        set event_name = case when $3::boolean then $4::text else event_name end,
            booth_name = case when $5::boolean then $6::text else booth_name end,
            queue_name = case when $7::boolean then $8::text else queue_name end,
            starts_at = case when $9::boolean then $10::timestamptz else starts_at end,
            ends_at = case when $11::boolean then $12::timestamptz else ends_at end,
            status = case when $13::boolean then $14::text else status end,
            accepting_entries = case when $15::boolean then $16::boolean else accepting_entries end,
            updated_at = now()
      where id = $1::uuid and owner_id = $2::uuid
      returning *`,
    [queueId, hostId, hasEvent, eventName, hasBooth, boothName, hasName, queueName,
      hasStart, startsAt, hasEnd, endsAt, hasStatus, status, hasAccepting, Boolean(changes.accepting_entries)]
  );
  const queue = firstRow(rows);
  if (!queue) throw Object.assign(new Error('This Host queue is unavailable.'), { status: 404, code: 'QUEUE_NOT_FOUND' });
  return queue;
}

async function callTicket(db, event, payload) {
  const hostId = await requireHost(db, event);
  const queueId = uuid(payload.queueId, 'Queue ID');
  const ticketNumber = optionalPositiveInteger(payload.ticketNumber, 2_147_483_647);
  const rows = await db.query(
    `update letsq.tickets t
        set status = 'called', called_at = now(), hold_until = null
      where t.id = (
        select candidate.id
        from letsq.tickets candidate
        join letsq.queues q on q.id = candidate.queue_id
        where candidate.queue_id = $1::uuid
          and q.owner_id = $2::uuid
          and candidate.ticket_number = $3::integer
          and candidate.status in ('waiting', 'hold', 'called', 'ready')
          and (candidate.status <> 'hold' or candidate.hold_until is null or candidate.hold_until <= now())
        order by candidate.queue_order
        limit 1
      )
      returning t.id, t.ticket_number, t.status::text`,
    [queueId, hostId, ticketNumber]
  );
  return firstRow(rows);
}

async function updateTicket(db, event, payload) {
  const hostId = await requireHost(db, event);
  const queueId = uuid(payload.queueId, 'Queue ID');
  const ticketId = uuid(payload.ticketId, 'Ticket ID');
  const status = payload.changes?.status;
  if (!['served', 'cancelled'].includes(status)) {
    const error = new Error('Ticket status is invalid.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  const rows = await db.query(
    `update letsq.tickets t
        set status = $4::letsq.ticket_status,
            served_at = case when $4::text = 'served' then now() else served_at end,
            closed_at = now(), private_note = null, hold_until = null
      where t.id = $1::uuid and t.queue_id = $2::uuid
        and t.status in ('waiting', 'called', 'ready', 'hold')
        and exists (select 1 from letsq.queues q where q.id = t.queue_id and q.owner_id = $3::uuid)
      returning t.id, t.ticket_number, t.status::text`,
    [ticketId, queueId, hostId, status]
  );
  const ticket = firstRow(rows);
  if (!ticket) throw Object.assign(new Error('This ticket is unavailable.'), { status: 404, code: 'TICKET_NOT_FOUND' });
  return ticket;
}

async function findQueue(db, event, payload) {
  await enforceRateLimit(db, event, 'find-queue', 120, 60);
  const joinCode = String(payload.joinCode || '').trim().toUpperCase();
  if (!JOIN_CODE_PATTERN.test(joinCode)) return null;
  const rows = await db.query(
    `select q.public_id, q.join_code, q.booth_name, q.event_name, q.queue_name,
            q.starts_at, q.ends_at, q.capacity, q.no_show_policy, q.status,
            q.accepting_entries,
            count(t.id) filter (where t.status in ('waiting', 'called', 'ready', 'hold'))::integer as active_count,
            coalesce((select current.ticket_number from letsq.tickets current
              where current.queue_id = q.id and current.status in ('called', 'ready')
              order by current.called_at desc nulls last, current.queue_order limit 1), 0)::integer as now_serving
       from letsq.queues q
       left join letsq.tickets t on t.queue_id = q.id
      where q.join_code = $1::text and q.status in ('open', 'closed')
      group by q.id`,
    [joinCode]
  );
  return firstRow(rows);
}

async function joinQueue(db, event, payload) {
  const publicQueueId = uuid(payload.publicQueueId, 'Public queue ID');
  await enforceRateLimit(db, event, 'join-queue', 180, 60, publicQueueId);
  const secretCode = String(payload.secretCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(secretCode)) {
    const error = new Error('Choose a secret code with 3–12 letters or numbers.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  const note = optionalString(payload.privateNote, 60);
  const rows = await db.query(
    'select * from letsq.join_queue($1::uuid, $2::text, $3::text)',
    [publicQueueId, secretCode, note]
  );
  return firstRow(rows);
}

async function getTicket(db, event, payload) {
  const accessToken = uuid(payload.accessToken, 'Ticket access token');
  await enforceRateLimit(db, event, 'get-ticket', 30, 60, accessToken);
  const rows = await db.query('select * from letsq.get_ticket($1::uuid)', [accessToken]);
  return firstRow(rows);
}

async function hostSnapshot(db, event, payload) {
  const hostId = await requireHost(db, event);
  const queueId = uuid(payload.queueId, 'Queue ID');
  await db.query('select letsq.release_expired_holds($1::uuid, $2::uuid)', [hostId, queueId]);
  const [queues, tickets] = await Promise.all([
    db.query(
      `select id, public_id, join_code, booth_name, event_name, queue_name, starts_at,
              ends_at, status, accepting_entries, next_queue_order
         from letsq.queues where id = $1::uuid and owner_id = $2::uuid`,
      [queueId, hostId]
    ),
    db.query(
      `select t.id, t.ticket_number, t.queue_order, t.status::text, t.no_show_attempts,
              t.private_note, t.called_at, t.hold_until
         from letsq.tickets t
         join letsq.queues q on q.id = t.queue_id
        where t.queue_id = $1::uuid and q.owner_id = $2::uuid
          and not (t.status = 'hold' and t.hold_until > now())
        order by t.queue_order`,
      [queueId, hostId]
    )
  ]);
  return { queue: firstRow(queues), tickets };
}

async function moveTicket(db, event, payload) {
  const hostId = await requireHost(db, event);
  const rows = await db.query(
    'select letsq.move_ticket($1::uuid, $2::uuid, $3::uuid, $4::boolean) as status',
    [hostId, uuid(payload.queueId, 'Queue ID'), uuid(payload.ticketId, 'Ticket ID'), Boolean(payload.countNoShow)]
  );
  return firstRow(rows);
}

async function createWalkIn(db, event, payload) {
  const hostId = await requireHost(db, event);
  const code = `W${randomBytes(6).toString('hex').slice(0, 10).toUpperCase()}`;
  const rows = await db.query(
    'select * from letsq.create_walk_in($1::uuid, $2::uuid, $3::text)',
    [hostId, uuid(payload.publicQueueId, 'Public queue ID'), code]
  );
  return firstRow(rows);
}

async function closeQueue(db, event, payload) {
  const hostId = await requireHost(db, event);
  const queueId = uuid(payload.queueId, 'Queue ID');
  await db.query('select letsq.close_queue($1::uuid, $2::uuid)', [hostId, queueId]);
  return { queueId, status: 'closed' };
}

async function cancelTicket(db, event, payload) {
  const accessToken = uuid(payload.accessToken, 'Ticket access token');
  await enforceRateLimit(db, event, 'cancel-ticket', 10, 60, accessToken);
  const rows = await db.query(
    `update letsq.tickets
        set status = 'cancelled', private_note = null, hold_until = null, closed_at = now()
      where access_token = $1::uuid and status in ('waiting', 'called', 'ready', 'hold')
      returning ticket_number, status::text`,
    [accessToken]
  );
  const ticket = firstRow(rows);
  if (!ticket) throw Object.assign(new Error('This ticket cannot be cancelled.'), { status: 409, code: 'TICKET_NOT_ACTIVE' });
  return ticket;
}

async function submitRating(db, event, payload) {
  const accessToken = uuid(payload.accessToken, 'Ticket access token');
  await enforceRateLimit(db, event, 'submit-rating', 5, 3600, accessToken);
  const scores = [payload.waitScore, payload.serviceScore, payload.returnScore].map(Number);
  if (scores.some(score => !Number.isInteger(score) || score < 1 || score > 5)) {
    const error = new Error('Choose all three survey scores from 1 to 5.');
    error.status = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }
  const rows = await db.query(
    `insert into letsq.ratings (queue_id, ticket_id, wait_score, service_score, return_score)
     select t.queue_id, t.id, $2::smallint, $3::smallint, $4::smallint
       from letsq.tickets t
      where t.access_token = $1::uuid and t.status = 'served'
     on conflict (ticket_id) do nothing
     returning id`,
    [accessToken, ...scores]
  );
  if (!firstRow(rows)) throw Object.assign(new Error('This ticket cannot be rated, or its survey was already submitted.'), { status: 409, code: 'RATING_NOT_ALLOWED' });
  return { submitted: true };
}

async function getReport(db, event, payload) {
  const hostId = await requireHost(db, event);
  const queueId = uuid(payload.queueId, 'Queue ID');
  const [queues, tickets, ratings] = await Promise.all([
    db.query(
      `select id, event_name, booth_name, queue_name, starts_at, ends_at, status, created_at
         from letsq.queues where id = $1::uuid and owner_id = $2::uuid`,
      [queueId, hostId]
    ),
    db.query(
      `select t.status::text, t.created_at, t.called_at, t.served_at, t.closed_at, t.no_show_attempts
         from letsq.tickets t join letsq.queues q on q.id = t.queue_id
        where t.queue_id = $1::uuid and q.owner_id = $2::uuid order by t.created_at`,
      [queueId, hostId]
    ),
    db.query(
      `select r.wait_score, r.service_score, r.return_score, r.created_at
         from letsq.ratings r join letsq.queues q on q.id = r.queue_id
        where r.queue_id = $1::uuid and q.owner_id = $2::uuid order by r.created_at`,
      [queueId, hostId]
    )
  ]);
  const queue = firstRow(queues);
  if (!queue) throw Object.assign(new Error('This Host queue is unavailable.'), { status: 404, code: 'QUEUE_NOT_FOUND' });
  return { queue, tickets, ratings };
}

async function route(db, event, action, payload) {
  switch (action) {
    case 'health': {
      const rows = await db.query('select current_database() as database, now() as checked_at');
      return { backend: 'neon', ...firstRow(rows) };
    }
    case 'ensure-host': return ensureHost(db, event);
    case 'create-queue': return createQueue(db, event, payload);
    case 'update-queue': return updateQueue(db, event, payload);
    case 'call-ticket': return callTicket(db, event, payload);
    case 'update-ticket': return updateTicket(db, event, payload);
    case 'find-queue': return findQueue(db, event, payload);
    case 'join-queue': return joinQueue(db, event, payload);
    case 'get-ticket': return getTicket(db, event, payload);
    case 'host-snapshot': return hostSnapshot(db, event, payload);
    case 'move-ticket': return moveTicket(db, event, payload);
    case 'create-walk-in': return createWalkIn(db, event, payload);
    case 'close-queue': return closeQueue(db, event, payload);
    case 'cancel-ticket': return cancelTicket(db, event, payload);
    case 'submit-rating': return submitRating(db, event, payload);
    case 'get-report': return getReport(db, event, payload);
    default: {
      const error = new Error('This queue action is not supported.');
      error.status = 404;
      error.code = 'ACTION_NOT_FOUND';
      throw error;
    }
  }
}

function publicDatabaseError(error) {
  if (error?.status) return error;
  const expectedCodes = new Set(['22023', 'P0001']);
  if (expectedCodes.has(error?.code)) return Object.assign(new Error(error.message), { status: 400, code: 'QUEUE_RULE' });
  if (error?.code === '22P02') return Object.assign(new Error('The request contains an invalid identifier.'), { status: 400, code: 'INVALID_REQUEST' });
  if (error?.code === '23505') return Object.assign(new Error('That action was already completed.'), { status: 409, code: 'CONFLICT' });
  if (error?.code === 'DATABASE_NOT_CONFIGURED' || error?.code === 'RATE_LIMIT_NOT_CONFIGURED') {
    return Object.assign(new Error('The queue service is not fully configured yet.'), { status: 503, code: error.code });
  }
  return Object.assign(new Error('The queue service is temporarily unavailable.'), { status: 500, code: 'INTERNAL_ERROR' });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return fail(405, 'Use POST for queue actions.', 'METHOD_NOT_ALLOWED');
  const requestId = event.headers?.['x-nf-request-id'] || randomUUID();
  try {
    const body = parseBody(event);
    const action = requiredString(body.action, 'Action', 40);
    const payload = requireObject(body.payload || {}, 'payload');
    const data = await route(database(), event, action, payload);
    return ok(data);
  } catch (sourceError) {
    const error = publicDatabaseError(sourceError);
    if (error.status >= 500) {
      console.error('letsq-api', { requestId, code: sourceError?.code || 'UNKNOWN', message: sourceError?.message || 'Unknown error' });
    }
    return fail(error.status, error.message, error.code);
  }
}

export const __test = {
  bearerToken,
  parseBody,
  publicDatabaseError,
  requestFingerprint,
  tokenHash,
  uuid
};
