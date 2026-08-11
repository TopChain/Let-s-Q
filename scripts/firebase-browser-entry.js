import { createClient } from '@supabase/supabase-js';

// Compatibility bridge for the current app.html. The legacy global name is
// preserved so the UI does not need a 2 MB in-place rewrite, but every queue
// operation below uses Supabase. Firebase is no longer the queue source of truth.
let api;
let uid = null;
let hostQueueId = null;
let selectedTicketToken = null;
let hooksInstalled = false;
let ticketPollTimer = null;

const HOST_QUEUE_KEY = 'letsq.supabase.hostQueueId';
const TICKETS_KEY = 'letsq.supabase.tickets.v1';
const SELECTED_TICKET_KEY = 'letsq.supabase.selectedTicket.v1';

function configured(config) {
  return Boolean(config?.supabaseUrl && config?.supabaseAnonKey);
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function stateRef() {
  try { return typeof appState !== 'undefined' ? appState : null; } catch { return null; }
}

function asIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function normalizeSecret(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(code)) throw new Error('Choose a secret code with 3–12 letters or numbers.');
  return code;
}

function policyFromUi() {
  const options = Array.from(document.querySelectorAll('input[name="policy"]'));
  const index = Math.max(0, options.findIndex(input => input.checked));
  return ['cancel', 'defer', 'hold'][index] || 'defer';
}

function targetOrdersFromUi() {
  const state = stateRef();
  if (state?.infiniteTarget) return null;
  const value = Number(document.getElementById('orderTarget')?.value || 0);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function mapQueue(row) {
  if (!row) return null;
  return {
    id: row.id || row.public_id,
    internalId: row.id || null,
    publicId: row.public_id || null,
    event: row.event_name || row.booth_name || row.queue_name || 'Let’s Q',
    store: row.booth_name || row.event_name || 'Host',
    queue: row.queue_name || 'Queue',
    code: row.join_code || '',
    start: asLocalInput(row.starts_at),
    end: asLocalInput(row.ends_at),
    status: row.status || 'open',
    acceptingEntries: row.accepting_entries !== false,
    nowServing: Number(row.now_serving || 0),
    served: Number(row.served_count || 0),
    activeCount: Number(row.active_count || 0)
  };
}

function savedTickets() {
  const value = readJson(TICKETS_KEY, []);
  return Array.isArray(value) ? value : [];
}

function saveTickets(tickets) {
  writeJson(TICKETS_KEY, tickets);
}

function saveTicket(ticket) {
  const tickets = savedTickets();
  const index = tickets.findIndex(item => item.accessToken === ticket.accessToken);
  if (index >= 0) tickets[index] = { ...tickets[index], ...ticket };
  else tickets.unshift(ticket);
  saveTickets(tickets.slice(0, 25));
  selectedTicketToken = ticket.accessToken;
  writeJson(SELECTED_TICKET_KEY, selectedTicketToken);
}

function selectedTicket() {
  const token = selectedTicketToken || readJson(SELECTED_TICKET_KEY, null);
  const tickets = savedTickets();
  return tickets.find(item => item.accessToken === token) || tickets[0] || null;
}

async function ensureHost() {
  if (!api) throw new Error('The queue service is not connected yet.');
  let { data: { session } } = await api.auth.getSession();
  if (!session) {
    const { data, error } = await api.auth.signInAnonymously();
    if (error) throw new Error(error.message || 'Could not create this device’s private Host identity.');
    session = data.session;
  }
  uid = session?.user?.id || null;
  if (!uid) throw new Error('Could not create this device’s private Host identity.');
  const { error } = await api.from('host_profiles').upsert({ id: uid }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return uid;
}

async function init(config) {
  if (!configured(config)) return null;
  api = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: `letsq-host-session-${new URL(config.supabaseUrl).hostname.split('.')[0]}`
    }
  });
  hostQueueId = readJson(HOST_QUEUE_KEY, null);
  selectedTicketToken = readJson(SELECTED_TICKET_KEY, null);
  setTimeout(() => {
    installHooks();
    syncSavedTicketsIntoUi();
    startTicketPolling();
  }, 0);
  // A Queuer does not create an Auth account merely by opening the app. Host
  // identity is created lazily by ensureHost() only when Host actions begin.
  return { backend: 'supabase' };
}

async function createQueue(queue) {
  const ownerId = await ensureHost();
  const values = {
    owner_id: ownerId,
    booth_name: String(queue.store || queue.event || 'Host').trim().slice(0, 60),
    event_name: String(queue.event || queue.store || 'Let’s Q').trim().slice(0, 80),
    queue_name: String(queue.queue || 'Queue').trim().slice(0, 40),
    starts_at: asIso(queue.start),
    ends_at: asIso(queue.end),
    capacity: null,
    target_orders: targetOrdersFromUi(),
    no_show_policy: policyFromUi(),
    status: 'open',
    accepting_entries: true
  };
  const { data, error } = await api.from('queues').insert(values).select().single();
  if (error) throw new Error(error.message);
  hostQueueId = data.id;
  writeJson(HOST_QUEUE_KEY, hostQueueId);
  return mapQueue(data);
}

async function updateQueue(queueId, changes = {}) {
  await ensureHost();
  const id = queueId || hostQueueId;
  if (!id) throw new Error('No Host queue is selected.');

  if (Number.isFinite(Number(changes.nowServing)) && Number(changes.nowServing) > 0) {
    const number = Number(changes.nowServing);
    const { data: ticket, error: findError } = await api.from('tickets')
      .select('id,status')
      .eq('queue_id', id)
      .eq('ticket_number', number)
      .in('status', ['waiting', 'hold', 'called', 'ready'])
      .order('queue_order')
      .limit(1)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (ticket && ticket.status !== 'called' && ticket.status !== 'ready') {
      const { error } = await api.from('tickets').update({ status: 'called', called_at: new Date().toISOString(), hold_until: null }).eq('id', ticket.id);
      if (error) throw new Error(error.message);
    }
  }

  const mapped = {};
  if ('event' in changes) mapped.event_name = String(changes.event || '').trim().slice(0, 80);
  if ('store' in changes) mapped.booth_name = String(changes.store || '').trim().slice(0, 60);
  if ('queue' in changes) mapped.queue_name = String(changes.queue || '').trim().slice(0, 40);
  if ('start' in changes) mapped.starts_at = asIso(changes.start);
  if ('end' in changes) mapped.ends_at = asIso(changes.end);
  if ('status' in changes) mapped.status = changes.status;
  if ('acceptingEntries' in changes) mapped.accepting_entries = Boolean(changes.acceptingEntries);
  if (Object.keys(mapped).length) {
    mapped.updated_at = new Date().toISOString();
    const { error } = await api.from('queues').update(mapped).eq('id', id);
    if (error) throw new Error(error.message);
  }
}

async function updateTicket(queueId, ticketId, changes = {}) {
  await ensureHost();
  if (!ticketId) throw new Error('No ticket is selected.');
  const mapped = {};
  if ('status' in changes) mapped.status = changes.status;
  if (changes.status === 'served') {
    mapped.served_at = new Date().toISOString();
    mapped.closed_at = new Date().toISOString();
    mapped.private_note = null;
    mapped.hold_until = null;
  }
  if (changes.status === 'cancelled') {
    mapped.closed_at = new Date().toISOString();
    mapped.private_note = null;
    mapped.hold_until = null;
  }
  const { error } = await api.from('tickets').update(mapped).eq('queue_id', queueId).eq('id', ticketId);
  if (error) throw new Error(error.message);
}

async function findQueueByCode(code) {
  if (!api) return null;
  const cleaned = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const { data, error } = await api.rpc('get_public_queue_by_code', { p_join_code: cleaned });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.status !== 'open') return null;
  return mapQueue(row);
}

async function joinQueue(queueId, ticket = {}) {
  if (!api) throw new Error('The queue service is not connected yet.');
  const secretCode = normalizeSecret(ticket.secretCode);
  const note = String(ticket.note || '').trim();
  if (note.length > 60) throw new Error('The optional request must be 60 characters or fewer.');
  const { data, error } = await api.rpc('join_queue', {
    p_public_queue_id: queueId,
    p_secret_code: secretCode,
    p_private_note: note || null
  });
  if (error) throw new Error(error.message);
  const created = Array.isArray(data) ? data[0] : data;
  if (!created) throw new Error('Could not create your ticket.');
  const state = stateRef();
  const active = state?.activeQueue || {};
  const record = {
    accessToken: created.access_token,
    publicId: queueId,
    code: active.code || '',
    secretCode,
    ticketNumber: created.ticket_number,
    status: created.ticket_status || 'waiting',
    event: active.event || active.store || 'Let’s Q',
    store: active.store || 'Host',
    queue: active.queue || 'Queue',
    accent: state?.selectedPersonal || '#006BFF',
    nowServing: Number(active.nowServing || 0),
    aheadCount: Number(active.activeCount || 0),
    updatedAt: Date.now()
  };
  saveTicket(record);
  setTimeout(() => {
    syncSavedTicketsIntoUi();
    void refreshSelectedTicket(false);
  }, 0);
  return { id: created.access_token, ticketNumber: created.ticket_number, accessToken: created.access_token };
}

function watchHostQueue(queueId, callback) {
  let stopped = false;
  let busy = false;
  const refresh = async () => {
    if (stopped || busy || !api) return;
    busy = true;
    try {
      await ensureHost();
      const { data: queue, error: queueError } = await api.from('queues')
        .select('id,public_id,join_code,booth_name,event_name,queue_name,starts_at,ends_at,status,accepting_entries,next_queue_order')
        .eq('id', queueId).maybeSingle();
      if (queueError || !queue) return;
      const { data: tickets, error: ticketError } = await api.from('tickets')
        .select('id,ticket_number,queue_order,status,no_show_attempts,private_note,called_at,hold_until')
        .eq('queue_id', queueId).order('queue_order');
      if (ticketError) return;
      const rows = tickets || [];
      const called = rows.find(item => item.status === 'called' || item.status === 'ready');
      const compatQueue = {
        ...mapQueue(queue),
        nowServing: Number(called?.ticket_number || 0),
        served: rows.filter(item => item.status === 'served').length
      };
      const compatTickets = rows.map(item => ({
        id: item.id,
        ticketNumber: item.ticket_number,
        status: ['waiting', 'called', 'ready', 'hold'].includes(item.status) ? 'waiting' : item.status,
        remoteStatus: item.status,
        secretCode: 'PRIVATE',
        note: item.private_note || '',
        noShowAttempts: Number(item.no_show_attempts || 0),
        queueOrder: Number(item.queue_order)
      }));
      callback({ queue: compatQueue, tickets: compatTickets });
    } catch (error) {
      console.warn('Let’s Q Host refresh failed', error);
    } finally {
      busy = false;
    }
  };
  void refresh();
  const timer = setInterval(refresh, 5000);
  return () => { stopped = true; clearInterval(timer); };
}

async function refreshSelectedTicket(notify = false) {
  const ticket = selectedTicket();
  if (!ticket?.accessToken || !api) return null;
  selectedTicketToken = ticket.accessToken;
  writeJson(SELECTED_TICKET_KEY, selectedTicketToken);
  const { data, error } = await api.rpc('get_my_ticket', { p_access_token: ticket.accessToken });
  if (error) {
    if (notify) toast(error.message || 'Could not refresh your ticket.');
    return null;
  }
  const current = Array.isArray(data) ? data[0] : data;
  if (!current) return null;
  const updated = {
    ...ticket,
    ticketNumber: current.ticket_number,
    status: current.status,
    queue: current.queue_name,
    store: current.booth_name,
    event: current.event_name || current.booth_name,
    aheadCount: Number(current.ahead_count || 0),
    nowServing: Number(current.now_serving || 0),
    publicId: current.public_queue_id || ticket.publicId,
    code: current.join_code || ticket.code,
    updatedAt: Date.now()
  };
  saveTicket(updated);
  updateTicketDom(updated);
  syncSavedTicketsIntoUi();
  if (notify) toast('Queue status updated.');
  return updated;
}

function updateTicketDom(ticket) {
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set('ticketNumber', String(ticket.ticketNumber || 0).padStart(3, '0'));
  set('ticketServing', String(ticket.nowServing || 0).padStart(3, '0'));
  set('ticketEventName', ticket.event || ticket.store || 'Let’s Q');
  set('ticketQueueName', ticket.queue || 'Queue');
  set('ticketSecret', ticket.secretCode || 'PRIVATE');
  const statusText = document.getElementById('ticketStatusText');
  const subText = document.getElementById('ticketSubText');
  const badge = document.getElementById('ticketStatusBadge');
  const progress = document.getElementById('ticketProgress');
  const status = ticket.status || 'waiting';
  if (['called', 'ready'].includes(status)) {
    if (statusText) statusText.textContent = 'It is your turn';
    if (subText) subText.textContent = 'Please return to the Host now.';
    if (badge) { badge.className = 'badge ready'; badge.innerHTML = '<span class="dot"></span>Your turn'; }
    if (progress) progress.style.width = '100%';
  } else if (status === 'served') {
    if (statusText) statusText.textContent = 'Completed';
    if (subText) subText.textContent = 'Thanks for using Let’s Q.';
    if (badge) { badge.className = 'badge info'; badge.innerHTML = '<span class="dot"></span>Served'; }
    if (progress) progress.style.width = '100%';
  } else if (status === 'cancelled') {
    if (statusText) statusText.textContent = 'Ticket cancelled';
    if (subText) subText.textContent = 'This number will not be reassigned.';
    if (badge) { badge.className = 'badge cancelled'; badge.innerHTML = '<span class="dot"></span>Cancelled'; }
    if (progress) progress.style.width = '0%';
  } else {
    const ahead = Number(ticket.aheadCount || 0);
    if (statusText) statusText.textContent = ahead ? `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead` : 'You are first in line';
    if (subText) subText.textContent = ahead ? `Estimated wait: about ${Math.max(2, ahead * 3)} minutes` : 'The Host will call you shortly';
    if (badge) { badge.className = 'badge waiting'; badge.innerHTML = '<span class="dot"></span>Waiting'; }
    if (progress) progress.style.width = `${Math.max(10, Math.min(90, 90 - ahead * 8))}%`;
  }
}

function syncSavedTicketsIntoUi() {
  const state = stateRef();
  if (!state) return;
  const tickets = savedTickets();
  state.queues = tickets.map((ticket, index) => ({
    id: 1000 + index,
    accessToken: ticket.accessToken,
    event: ticket.event || ticket.store || 'Let’s Q',
    queue: ticket.queue || 'Queue',
    number: String(ticket.ticketNumber || 0).padStart(3, '0'),
    status: ticket.status === 'cancelled' || ticket.status === 'served' ? 'history' : ['called', 'ready'].includes(ticket.status) ? 'ready' : 'waiting',
    accent: ticket.accent || '#006BFF',
    meta: ticket.status === 'cancelled' ? 'Cancelled' : ticket.status === 'served' ? 'Completed' : ['called', 'ready'].includes(ticket.status) ? 'Your turn now' : Number(ticket.aheadCount || 0) ? `${ticket.aheadCount} ahead` : 'First in line'
  }));
  try { window.renderQueueList?.(); } catch {}
}

function startTicketPolling() {
  clearInterval(ticketPollTimer);
  ticketPollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void refreshSelectedTicket(false);
  }, 15000);
}

function toast(message) {
  try { window.showToast?.(message); } catch { console.info(message); }
}

async function moveHostTicketToBack(ticket, countNoShow) {
  const state = stateRef();
  const queueId = state?.activeQueue?.internalId || state?.activeQueue?.id || hostQueueId;
  if (!queueId || !ticket?.id) return;
  await ensureHost();
  const { data: queue, error: queueError } = await api.from('queues').select('next_queue_order').eq('id', queueId).single();
  if (queueError) throw new Error(queueError.message);
  const attempts = Number(ticket.noShowAttempts || 0) + (countNoShow ? 1 : 0);
  if (countNoShow && attempts >= 3) {
    const { error } = await api.from('tickets').update({ status: 'cancelled', no_show_attempts: attempts, private_note: null, hold_until: null, closed_at: new Date().toISOString() }).eq('id', ticket.id);
    if (error) throw new Error(error.message);
    return;
  }
  const order = Number(queue.next_queue_order || 1);
  const { error } = await api.from('tickets').update({ status: 'waiting', queue_order: order, no_show_attempts: attempts, called_at: null, hold_until: null }).eq('id', ticket.id);
  if (error) throw new Error(error.message);
  const { error: bumpError } = await api.from('queues').update({ next_queue_order: order + 1, updated_at: new Date().toISOString() }).eq('id', queueId);
  if (bumpError) throw new Error(bumpError.message);
}

async function createWalkIn() {
  const state = stateRef();
  const publicId = state?.activeQueue?.publicId;
  if (!publicId) throw new Error('Start a Host queue first.');
  const code = `W${Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;
  const { data, error } = await api.rpc('join_queue', { p_public_queue_id: publicId, p_secret_code: code, p_private_note: 'Walk-in ticket' });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
}

async function closeHostQueue() {
  const state = stateRef();
  const queueId = state?.activeQueue?.internalId || state?.activeQueue?.id || hostQueueId;
  if (!queueId) throw new Error('No Host queue is selected.');
  await ensureHost();
  const now = new Date().toISOString();
  const { error: ticketError } = await api.from('tickets')
    .update({ status: 'cancelled', private_note: null, hold_until: null, closed_at: now })
    .eq('queue_id', queueId)
    .in('status', ['waiting', 'called', 'ready', 'hold']);
  if (ticketError) throw new Error(ticketError.message);
  const { error } = await api.from('queues').update({ status: 'closed', accepting_entries: false, updated_at: now }).eq('id', queueId);
  if (error) throw new Error(error.message);
}

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  window.refreshTicketStatus = () => refreshSelectedTicket(true);

  window.openQueue = async id => {
    const state = stateRef();
    const entry = state?.queues?.find(item => item.id === id);
    if (!entry?.accessToken) return;
    selectedTicketToken = entry.accessToken;
    writeJson(SELECTED_TICKET_KEY, selectedTicketToken);
    const saved = selectedTicket();
    if (saved) {
      state.activeQueue = { id: saved.publicId, publicId: saved.publicId, event: saved.event, store: saved.store, queue: saved.queue, code: saved.code, nowServing: saved.nowServing };
    }
    try { window.switchTab?.('queuer'); window.setQueuerView?.('ticket'); } catch {}
    await refreshSelectedTicket(false);
  };

  window.cancelTicket = async () => {
    const ticket = selectedTicket();
    if (!ticket?.accessToken) { toast('No live ticket is selected.'); return; }
    const { error } = await api.rpc('cancel_my_ticket', { p_access_token: ticket.accessToken });
    if (error) { toast(error.message || 'Could not cancel this ticket.'); return; }
    saveTicket({ ...ticket, status: 'cancelled', updatedAt: Date.now() });
    try { window.closeModal?.(); window.switchTab?.('list'); } catch {}
    syncSavedTicketsIntoUi();
    toast(`Ticket ${String(ticket.ticketNumber || 0).padStart(3, '0')} cancelled.`);
  };

  window.togglePause = async () => {
    const state = stateRef();
    const queueId = state?.activeQueue?.internalId || state?.activeQueue?.id || hostQueueId;
    if (!queueId) { toast('Start a Host queue first.'); return; }
    const nextPaused = !state.paused;
    try {
      await updateQueue(queueId, { acceptingEntries: !nextPaused });
      state.paused = nextPaused;
      const button = document.getElementById('pauseBtn');
      if (button) { button.textContent = nextPaused ? 'Resume scans' : 'Pause scans'; button.className = `btn ${nextPaused ? 'danger' : 'secondary'} small`; }
      toast(nextPaused ? 'New joins are paused; existing tickets continue.' : 'New joins resumed.');
    } catch (error) { toast(error.message || 'Could not change queue status.'); }
  };

  window.skipTicket = async () => {
    const state = stateRef();
    const ticket = state?.waiting?.[0];
    if (!ticket) { toast('No active ticket.'); return; }
    try { await moveHostTicketToBack(ticket, false); toast(`Ticket ${String(ticket.ticketNumber || ticket.number || 0).padStart(3, '0')} moved to the back.`); }
    catch (error) { toast(error.message || 'Could not move this ticket.'); }
  };

  window.noShow = async () => {
    const state = stateRef();
    const ticket = state?.waiting?.[0];
    if (!ticket) { toast('No active ticket.'); return; }
    try { await moveHostTicketToBack(ticket, true); toast('No-show recorded. The queue policy was applied.'); }
    catch (error) { toast(error.message || 'Could not apply the no-show policy.'); }
  };

  window.addWalkin = async () => {
    try {
      const created = await createWalkIn();
      window.closeModal?.();
      toast(`Walk-in ticket ${String(created?.ticket_number || 0).padStart(3, '0')} created.`);
    } catch (error) { toast(error.message || 'Could not create a walk-in ticket.'); }
  };

  const originalOpenModal = window.openModal;
  if (typeof originalOpenModal === 'function') {
    window.openModal = function(type) {
      originalOpenModal(type);
      if (type === 'survey') {
        setTimeout(() => {
          const modal = document.getElementById('modalContent');
          const submit = Array.from(modal?.querySelectorAll('button') || []).find(button => button.textContent.trim() === 'Submit survey');
          if (!submit) return;
          submit.onclick = async event => {
            event.preventDefault();
            const scores = Array.from(modal.querySelectorAll('.segmented')).map(group => {
              const active = group.querySelector('button.active');
              return active ? Array.from(group.querySelectorAll('button')).indexOf(active) + 1 : 0;
            });
            if (scores.length < 3 || scores.some(score => score < 1)) { toast('Choose all three survey scores.'); return; }
            const ticket = selectedTicket();
            if (!ticket?.accessToken) { toast('No ticket is selected.'); return; }
            const { error } = await api.rpc('submit_anonymous_rating', {
              p_access_token: ticket.accessToken,
              p_wait_score: scores[0],
              p_service_score: scores[1],
              p_return_score: scores[2]
            });
            if (error) { toast(error.message || 'The survey can be submitted after service is completed.'); return; }
            window.closeModal?.();
            toast('Anonymous survey submitted.');
          };
        }, 0);
      }
      if (type === 'closeQueue') {
        setTimeout(() => {
          const modal = document.getElementById('modalContent');
          const closeButton = Array.from(modal?.querySelectorAll('button') || []).find(button => button.textContent.includes('Close queue'));
          if (!closeButton) return;
          closeButton.onclick = async event => {
            event.preventDefault();
            try { await closeHostQueue(); window.closeModal?.(); toast('Queue closed. Remaining tickets were cancelled.'); }
            catch (error) { toast(error.message || 'Could not close the queue.'); }
          };
        }, 0);
      }
    };
  }
}

window.LetsQFirebase = {
  init,
  createQueue,
  updateQueue,
  updateTicket,
  findQueueByCode,
  joinQueue,
  watchHostQueue,
  get uid() { return uid; },
  get backend() { return 'supabase'; }
};
