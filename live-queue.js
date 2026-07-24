/*
 * Real queue bridge. It is intentionally dormant while runtime-config.js has
 * demoMode: true, so the public prototype remains safe until the Supabase
 * migration and live device test have both completed.
 */
(() => {
  const config = window.LETS_Q_CONFIG || {};
  if (config.demoMode || !config.supabaseUrl || !config.supabaseAnonKey) return;

  const state = window.letsQState;
  const supabaseLibrary = window.LetsQSupabase || window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
  // Keep anonymous host sessions separate for each Supabase project. This prevents
  // a test device from reusing a token from an older project after its settings change.
  const projectRef = new URL(config.supabaseUrl).hostname.split('.')[0];
  const api = supabaseLibrary?.createClient?.(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: `lets-q-host-session-${projectRef}` }
  });
  if (!state || !api) {
    console.error('Let’s Q live mode could not start because its local Supabase library is missing.');
    return;
  }

  const hostQueueKey = 'lets-q-live-host-queue-id';
  const ticketKey = 'lets-q-live-ticket';
  const ticketsKey = 'lets-q-live-tickets';
  const saved = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const remove = (key) => localStorage.removeItem(key);
  const text = (error, fallback) => error?.message || fallback;
  const time = (iso) => iso ? new Date(iso).toTimeString().slice(0, 5) : '00:00';
  const isoDateTime = (dateValue, timeValue) => new Date(`${dateValue}T${timeValue}:00`).toISOString();
  const date = (iso) => {
    if (!iso) return '';
    const value = new Date(iso);
    const offset = value.getTimezoneOffset() * 60000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 10);
  };
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

  function savedTickets() {
    const many = saved(ticketsKey);
    const list = Array.isArray(many) ? many : [];
    const legacy = saved(ticketKey);
    if (legacy?.accessToken && !list.some((ticket) => ticket.accessToken === legacy.accessToken)) list.push(legacy);
    return list;
  }

  function saveTickets(tickets) {
    save(ticketsKey, tickets);
    const selected = tickets.find((ticket) => ticket.accessToken === state.selectedLiveTicket) || tickets[0] || null;
    if (selected) save(ticketKey, selected); else remove(ticketKey);
    state.myTickets = tickets;
  }

  function selectedTicket() {
    const tickets = savedTickets();
    return tickets.find((ticket) => ticket.accessToken === state.selectedLiveTicket)
      || tickets.find((ticket) => ticket.publicId === state.livePublicQueueId)
      || null;
  }

  function upsertTicket(ticket) {
    const tickets = savedTickets();
    const index = tickets.findIndex((savedTicket) => savedTicket.accessToken === ticket.accessToken);
    if (index >= 0) tickets[index] = { ...tickets[index], ...ticket };
    else tickets.unshift(ticket);
    saveTickets(tickets);
  }

  function liveQueuePayload() {
    if (!state.livePublicQueueId) return '';
    const publicUrl = String(config.publicAppUrl || '').trim().replace(/\/$/, '');
    return publicUrl ? `${publicUrl}/join/${state.livePublicQueueId}` : `letsq://join/${state.livePublicQueueId}`;
  }

  async function refreshLiveQr() {
    const payload = liveQueuePayload();
    if (!payload || state.liveQrPayload === payload || !window.LetsQQr?.toDataUrl) return;
    try {
      state.liveQrPayload = payload;
      state.liveQrDataUrl = await window.LetsQQr.toDataUrl(payload);
      window.render();
    } catch (error) {
      console.warn('Let’s Q could not generate the live QR code.', error);
    }
  }

  const hostTicket = (ticket) => ({
    id: ticket.id,
    n: ticket.ticket_number,
    order: Number(ticket.queue_order),
    code: 'private',
    state: ticket.status,
    attempts: ticket.no_show_attempts,
    note: ticket.private_note || '',
    holdUntil: ticket.hold_until ? new Date(ticket.hold_until).getTime() : undefined
  });

  function hydrateQueue(queue) {
    state.liveMode = true;
    state.liveHostQueueId = queue.id || state.liveHostQueueId;
    state.livePublicQueueId = queue.public_id || state.livePublicQueueId;
    state.liveJoinCode = queue.join_code || state.liveJoinCode;
    state.liveQueueStatus = queue.status || state.liveQueueStatus || 'open';
    state.liveNextQueueOrder = Number(queue.next_queue_order || state.liveNextQueueOrder || 1);
    state.liveActiveCount = queue.active_count;
    state.booth = queue.booth_name;
    state.queue = queue.queue_name;
    state.capacity = queue.capacity === null || queue.capacity === undefined ? Infinity : Number(queue.capacity);
    state.serviceTarget = queue.target_orders ?? state.serviceTarget ?? null;
    state.policy = queue.no_show_policy;
    if (queue.hold_minutes) state.holdMinutes = Number(queue.hold_minutes);
    if (queue.starts_at) { state.startDate = date(queue.starts_at); state.startTime = time(queue.starts_at); }
    if (queue.ends_at) { state.endDate = date(queue.ends_at); state.endTime = time(queue.ends_at); }
    if (queue.now_serving !== undefined) state.now = Number(queue.now_serving || 0);
    void refreshLiveQr();
  }

  async function ensureHost() {
    let { data: { session } } = await api.auth.getSession();
    if (!session) {
      const { data, error } = await api.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    const userId = session?.user?.id;
    if (!userId) throw new Error('Could not create this device’s private Host identity.');
    const { error } = await api.from('host_profiles').upsert({ id: userId }, { onConflict: 'id' });
    if (error) throw error;
    return userId;
  }

  async function releaseExpiredHolds() {
    if (!state.liveHostQueueId) return;
    await api.from('tickets')
      .update({ status: 'waiting', hold_until: null })
      .eq('queue_id', state.liveHostQueueId)
      .eq('status', 'hold')
      .lt('hold_until', new Date().toISOString());
  }

  async function refreshHost(showError = false) {
    const id = state.liveHostQueueId || saved(hostQueueKey);
    if (!id) return false;
    await releaseExpiredHolds();
    const { data: queue, error: queueError } = await api.from('queues')
      .select('id,public_id,join_code,booth_name,queue_name,starts_at,ends_at,capacity,target_orders,no_show_policy,hold_minutes,next_queue_order,status')
      .eq('id', id).maybeSingle();
    if (queueError || !queue) {
      remove(hostQueueKey);
      if (showError) window.toast(text(queueError, 'This Host queue is not available on this device.'));
      return false;
    }
    const { data: tickets, error: ticketError } = await api.from('tickets')
      .select('id,ticket_number,queue_order,status,no_show_attempts,private_note,called_at,hold_until')
      .eq('queue_id', id).order('queue_order');
    if (ticketError) {
      if (showError) window.toast(text(ticketError, 'Could not refresh the live queue.'));
      return false;
    }
    hydrateQueue(queue);
    state.tickets = (tickets || []).map(hostTicket);
    state.called = state.tickets.find((ticket) => ticket.state === 'called' || ticket.state === 'ready') || null;
    state.now = state.called?.n || 0;
    state.next = Math.max(1, ...state.tickets.map((ticket) => ticket.n + 1));
    state.nextOrder = Math.max(1, ...state.tickets.map((ticket) => ticket.order + 1));
    state.served = state.tickets.filter((ticket) => ticket.state === 'served').length;
    state.noShow = state.tickets.reduce((total, ticket) => total + ticket.attempts, 0);
    state.liveActiveCount = state.tickets.filter((ticket) => ['waiting', 'called', 'ready', 'hold'].includes(ticket.state)).length;
    window.render();
    return true;
  }

  async function openLiveQueue(publicId, notify = true) {
    if (!isUuid(publicId)) throw new Error('That is not a valid Let’s Q queue link.');
    const { data, error } = await api.rpc('get_public_queue', { p_public_queue_id: publicId });
    const queue = Array.isArray(data) ? data[0] : data;
    if (error || !queue) throw new Error(text(error, 'This queue is unavailable.'));

    // Opening a different queue prepares a new ticket without deleting any
    // existing saved tickets. A Queuer can therefore hold places in more than
    // one line on the same private device.
    const savedTicket = selectedTicket();
    if (savedTicket?.publicId !== publicId) {
      state.selectedLiveTicket = null;
      state.my = null;
      state.rated = false;
    }
    hydrateQueue(queue);
    state.livePublicQueueId = publicId;
    state.liveActiveCount = Number(queue.active_count || 0);
    state.tickets = [];
    window.render();
    // A ticket refresh happens repeatedly while the Queuer is reading the
    // screen. Do not route again in that case, because goTo intentionally
    // scrolls to the top for a new page.
    if (state.currentView !== 'queuer') window.goTo('queuer');
    if (notify) window.toast('Live queue opened. Choose a private secret code to join.');
    return queue;
  }

  async function openLiveQueueByCode(joinCode) {
    const code = String(joinCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^Q[A-Z0-9]{5}$/.test(code)) throw new Error('Enter a queue code like Q7K2M9.');
    const { data, error } = await api.rpc('get_public_queue_by_code', { p_join_code: code });
    const queue = Array.isArray(data) ? data[0] : data;
    if (error || !queue) throw new Error(text(error, 'That queue code is not available.'));
    return openLiveQueue(queue.public_id);
  }

  async function refreshTicket(showError = false) {
    const ticket = selectedTicket();
    if (!ticket?.accessToken) return false;
    // A QR scan or manual code may have just opened another queue. Its view
    // must never be replaced by this device's ticket from a previous queue.
    if (state.livePublicQueueId && ticket.publicId !== state.livePublicQueueId) return false;
    const { data, error } = await api.rpc('get_my_ticket', { p_access_token: ticket.accessToken });
    const current = Array.isArray(data) ? data[0] : data;
    if (error || !current) {
      if (showError) window.toast(text(error, 'Could not refresh your ticket.'));
      return false;
    }
    const updatedTicket = { ...ticket, status: current.status, ticketNumber: current.ticket_number, boothName: current.booth_name, queueName: current.queue_name };
    upsertTicket(updatedTicket);
    state.selectedLiveTicket = updatedTicket.accessToken;
    state.livePublicQueueId = updatedTicket.publicId;
    state.my = { n: current.ticket_number, code: updatedTicket.code, state: current.status, attempts: 0, note: '' };
    state.booth = current.booth_name;
    state.queue = current.queue_name;
    try { await openLiveQueue(updatedTicket.publicId, false); } catch { window.render(); }
    return true;
  }

  async function refreshSavedTickets(showError = false) {
    const tickets = savedTickets();
    if (!tickets.length) { state.myTickets = []; window.render(); return []; }
    const refreshed = await Promise.all(tickets.map(async (ticket) => {
      try {
        const { data, error } = await api.rpc('get_my_ticket', { p_access_token: ticket.accessToken });
        const current = Array.isArray(data) ? data[0] : data;
        if (error || !current) return ticket;
        return { ...ticket, status: current.status, ticketNumber: current.ticket_number, boothName: current.booth_name, queueName: current.queue_name };
      } catch { return ticket; }
    }));
    saveTickets(refreshed);
    if (showError && !refreshed.length) window.toast('Could not refresh your saved queues.');
    window.render();
    return refreshed;
  }

  async function saveHostSetup() {
    const booth = document.querySelector('#setup-booth').value.trim();
    const queueName = document.querySelector('#setup-queue').value.trim();
    const startDate = document.querySelector('#setup-start-date')?.value;
    const endDate = document.querySelector('#setup-end-date')?.value;
    const startTime = document.querySelector('#setup-start').value;
    const endTime = document.querySelector('#setup-end').value;
    const targetOrders = Number(document.querySelector('#setup-service-target')?.value || 0) || null;
    const selected = document.querySelector('input[name="noShowPolicy"]:checked');
    if (!booth || !queueName) throw new Error('Add both a booth/event name and a queue name.');
    if (!startDate || !endDate || !startTime || !endTime) throw new Error('Choose a start and end date and time.');
    if (startDate > endDate || (startDate === endDate && startTime >= endTime)) throw new Error('Choose an end date and time later than the start.');
    if (targetOrders !== null && (!Number.isInteger(targetOrders) || targetOrders < 1)) throw new Error('Planned orders must be a whole number.');
    const ownerId = await ensureHost();
    // Restore a saved queue before deciding whether this is a brand-new one.
    // Without this, reopening the app and pressing Start could create a second
    // queue while its older QR code was still in use.
    if (!state.liveHostQueueId && saved(hostQueueKey)) await refreshHost(false);
    const values = {
      booth_name: booth, queue_name: queueName, starts_at: isoDateTime(startDate, startTime), ends_at: isoDateTime(endDate, endTime),
      capacity: null, target_orders: targetOrders, no_show_policy: selected?.value || 'defer', hold_minutes: Math.max(1, Math.min(30, Number(document.querySelector('#hold-minutes').value) || 5)), status: 'open'
    };
    let result;
    if (state.liveHostQueueId) {
      result = await api.from('queues').update(values).eq('id', state.liveHostQueueId).select().single();
    } else {
      state.tickets = [];
      state.my = null;
      result = await api.from('queues').insert({ ...values, owner_id: ownerId }).select().single();
    }
    if (result.error) throw result.error;
    state.liveHostQueueId = result.data.id;
    save(hostQueueKey, result.data.id);
    await refreshHost(true);
    window.goTo('organizer');
    window.toast('Live queue saved. This Host device can now manage it.');
  }

  async function moveToBack(ticket, status, extra = {}) {
    const order = state.liveNextQueueOrder || state.nextOrder || 1;
    const { error } = await api.from('tickets').update({ status, queue_order: order, ...extra }).eq('id', ticket.id);
    if (error) throw error;
    const { error: queueError } = await api.from('queues').update({ next_queue_order: order + 1, updated_at: new Date().toISOString() }).eq('id', state.liveHostQueueId);
    if (queueError) throw queueError;
  }

  window.applyHostSetup = async () => {
    try { await saveHostSetup(); } catch (error) { window.toast(text(error, 'Could not save the live queue.')); }
  };

  window.callNext = async () => {
    try {
      await releaseExpiredHolds();
      await refreshHost();
      const next = state.tickets.filter((ticket) => ticket.state === 'waiting').sort((a, b) => a.order - b.order)[0];
      if (!next) return window.toast('Nobody is waiting.');
      const { error } = await api.from('tickets').update({ status: 'called', called_at: new Date().toISOString() }).eq('id', next.id).eq('status', 'waiting');
      if (error) throw error;
      await refreshHost(true);
      window.toast(`Calling #${next.n}.`);
    } catch (error) { window.toast(text(error, 'Could not call the next ticket.')); }
  };

  window.present = async () => {
    try {
      const ticket = state.called;
      if (!ticket) return;
      const { error } = await api.from('tickets').update({ status: 'served', private_note: null, hold_until: null, served_at: new Date().toISOString(), closed_at: new Date().toISOString() }).eq('id', ticket.id);
      if (error) throw error;
      await refreshHost(true);
      window.toast(`#${ticket.n} served. Its optional note was removed.`);
    } catch (error) { window.toast(text(error, 'Could not complete this ticket.')); }
  };

  window.skip = async () => {
    try {
      const ticket = state.called;
      if (!ticket) return;
      await moveToBack(ticket, 'waiting', { called_at: null, hold_until: null });
      await refreshHost(true);
      window.toast(`#${ticket.n} moved to the back of the live queue.`);
    } catch (error) { window.toast(text(error, 'Could not skip this ticket.')); }
  };

  window.noShow = async () => {
    try {
      const ticket = state.called;
      if (!ticket) return;
      const attempts = Number(ticket.attempts || 0) + 1;
      const cancel = state.policy === 'cancel' || attempts >= 3;
      if (cancel) {
        const { error } = await api.from('tickets').update({ status: 'cancelled', no_show_attempts: attempts, private_note: null, hold_until: null, closed_at: new Date().toISOString() }).eq('id', ticket.id);
        if (error) throw error;
      } else if (state.policy === 'hold') {
        const until = new Date(Date.now() + state.holdMinutes * 60000).toISOString();
        await moveToBack(ticket, 'hold', { no_show_attempts: attempts, hold_until: until, called_at: null });
      } else {
        await moveToBack(ticket, 'waiting', { no_show_attempts: attempts, called_at: null, hold_until: null });
      }
      await refreshHost(true);
      window.toast(cancel ? `#${ticket.n} cancelled.` : `#${ticket.n} was moved according to the no-show rule.`);
    } catch (error) { window.toast(text(error, 'Could not apply the no-show rule.')); }
  };

  window.join = async () => {
    try {
      if (!state.livePublicQueueId) return window.toast('Scan a Host’s live QR code first.');
      const code = document.querySelector('#code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const note = document.querySelector('#note').value.trim();
      if (code.length < 3) return window.toast('Use at least 3 letters or numbers.');
      const { data, error } = await api.rpc('join_queue', { p_public_queue_id: state.livePublicQueueId, p_secret_code: code, p_private_note: note || null });
      const ticket = Array.isArray(data) ? data[0] : data;
      if (error || !ticket) throw new Error(text(error, 'Could not join this queue.'));
      const record = { accessToken: ticket.access_token, publicId: state.livePublicQueueId, code, ticketNumber: ticket.ticket_number, status: ticket.ticket_status, boothName: state.booth, queueName: state.queue };
      state.selectedLiveTicket = record.accessToken;
      upsertTicket(record);
      state.my = { n: ticket.ticket_number, code, state: ticket.ticket_status, attempts: 0, note: '' };
      state.liveActiveCount = Number(state.liveActiveCount || 0) + 1;
      window.render();
      window.toast(`Ticket #${ticket.ticket_number} created. No contact details were collected.`);
    } catch (error) { window.toast(text(error, 'Could not join this queue.')); }
  };

  window.cancelMine = async () => {
    try {
      const ticket = selectedTicket();
      if (!ticket?.accessToken) return;
      const { error } = await api.rpc('cancel_my_ticket', { p_access_token: ticket.accessToken });
      if (error) throw error;
      upsertTicket({ ...ticket, status: 'cancelled' });
      state.my.state = 'cancelled';
      window.render();
      window.toast('Ticket cancelled. Its optional note was removed.');
    } catch (error) { window.toast(text(error, 'Could not cancel this ticket.')); }
  };

  window.startNewTicket = () => { state.selectedLiveTicket = null; state.my = null; state.rated = false; window.render(); };

  async function loadQueueHistory() {
    const { data, error } = await api.from('queues')
      .select('id,booth_name,queue_name,status,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(25);
    if (error) throw error;
    state.liveQueueHistory = data || [];
    return state.liveQueueHistory;
  }

  async function loadAnalytics(queueId = state.analyticsQueueId || state.liveHostQueueId) {
    if (!queueId) return null;
    const [queueResult, ticketsResult, ratingsResult] = await Promise.all([
      api.from('queues').select('id,booth_name,queue_name,status,capacity').eq('id', queueId).maybeSingle(),
      api.from('tickets').select('status,no_show_attempts,created_at,served_at').eq('queue_id', queueId),
      api.from('ratings').select('wait_score,service_score,return_score').eq('queue_id', queueId)
    ]);
    if (queueResult.error) throw queueResult.error;
    if (ticketsResult.error) throw ticketsResult.error;
    if (ratingsResult.error) throw ratingsResult.error;
    if (!queueResult.data) return null;
    const tickets = ticketsResult.data || [];
    const served = tickets.filter((ticket) => ticket.status === 'served');
    const averageWaitMinutes = served.length
      ? served.reduce((total, ticket) => total + Math.max(0, new Date(ticket.served_at) - new Date(ticket.created_at)), 0) / served.length / 60000
      : null;
    state.analyticsQueueId = queueId;
    state.liveAnalytics = {
      queue: queueResult.data,
      total: tickets.length,
      served: served.length,
      noShowAttempts: tickets.reduce((total, ticket) => total + Number(ticket.no_show_attempts || 0), 0),
      averageWaitMinutes,
      ratings: ratingsResult.data || []
    };
    return state.liveAnalytics;
  }

  window.selectAnalyticsQueue = async (queueId) => {
    try {
      await loadAnalytics(queueId);
      window.render();
    } catch (error) { window.toast(text(error, 'Could not load this queue’s analytics.')); }
  };

  window.endLiveQueue = async () => {
    try {
      await refreshHost();
      if (state.liveActiveCount > 0) {
        return window.toast('Finish or cancel the remaining tickets before ending this queue.');
      }
      const queueId = state.liveHostQueueId || saved(hostQueueKey);
      if (!queueId) return window.toast('There is no active Host queue to end.');
      const { error } = await api.from('queues').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', queueId);
      if (error) throw error;
      state.analyticsQueueId = queueId;
      state.liveHostQueueId = null;
      state.livePublicQueueId = null;
      state.liveJoinCode = null;
      state.liveQueueStatus = null;
      state.liveQrPayload = null;
      state.liveQrDataUrl = null;
      remove(hostQueueKey);
      await Promise.all([loadQueueHistory(), loadAnalytics(queueId)]);
      window.goTo('report');
      window.toast('Queue ended. Its anonymous ratings and totals were saved.');
    } catch (error) { window.toast(text(error, 'Could not end this queue.')); }
  };

  window.startNewLiveQueue = () => {
    state.analyticsQueueId = null;
    state.liveAnalytics = null;
    window.goTo('setup');
    window.toast('Enter the new booth or queue name, then select Start this queue.');
  };

  window.submitRating = async () => {
    try {
      const ticket = selectedTicket();
      const wait = document.querySelector('input[name="wait-rating"]:checked');
      const service = document.querySelector('input[name="service-rating"]:checked');
      const again = document.querySelector('input[name="return-rating"]:checked');
      if (!ticket?.accessToken || !wait || !service || !again) return window.toast('Choose one score for each question.');
      const { error } = await api.rpc('submit_anonymous_rating', { p_access_token: ticket.accessToken, p_wait_score: Number(wait.value), p_service_score: Number(service.value), p_return_score: Number(again.value) });
      if (error) throw error;
      state.rated = true;
      window.render(); window.goTo('queuer'); window.toast('Thank you. Your anonymous rating was added.'); window.showRatingInterstitial?.();
    } catch (error) { window.toast(text(error, 'Could not submit this rating.')); }
  };

  window.openScannedQueue = async (value) => {
    window.stopScanner();
    try {
      const raw = String(value).trim();
      if (/^Q[A-Z0-9]{5}$/i.test(raw)) { await openLiveQueueByCode(raw); return; }
      let id = '';
      try {
        const link = new URL(value);
        id = link.searchParams.get('join') || link.pathname.split('/').filter(Boolean).pop() || '';
      } catch { id = String(value).trim(); }
      await openLiveQueue(id);
    } catch (error) { window.toast(text(error, 'That is not a live Let’s Q queue QR.')); }
  };

  window.refreshSavedTickets = () => refreshSavedTickets(true);

  window.useDemoQueue = async () => {
    const value = window.prompt('Paste a Host queue link or enter a code like Q7K2M9.');
    if (value) await window.openScannedQueue(value);
  };

  window.joinByCode = async () => {
    const input = document.querySelector('#manual-queue-code');
    try { await openLiveQueueByCode(input?.value); }
    catch (error) { window.toast(text(error, 'Could not open that queue.')); }
  };

  const oldGoTo = window.goTo;
  window.goTo = (view) => {
    oldGoTo(view);
    if (view === 'organizer') refreshHost();
    if (view === 'setup') {
      refreshHost().then((found) => {
        if (found && state.currentView === 'setup') window.syncHostSetup?.();
      });
    }
    if (view === 'queuer') refreshTicket();
    if (view === 'q-list') refreshSavedTickets();
    if (view === 'report') {
      loadQueueHistory()
        .then(() => loadAnalytics())
        .then(() => window.render())
        .catch((error) => window.toast(text(error, 'Could not load the saved queue analytics.')));
    }
  };

  function renderLiveAnalytics() {
    if (!state.liveMode || state.currentView !== 'report') return;
    const panel = document.querySelector('#reportPanel');
    if (!panel) return;
    if (!state.adFree) {
      const note = panel.querySelector('[data-live-rating-note]');
      if (!note) panel.insertAdjacentHTML('beforeend', '<p class="hint" data-live-rating-note>Customer ratings are saved anonymously with each finished queue and become visible with ad-free analytics.</p>');
      return;
    }
    const analytics = state.liveAnalytics;
    if (!analytics) {
      panel.innerHTML = '<p class="hint">Loading saved queue analytics…</p>';
      return;
    }
    const ratings = analytics.ratings;
    const average = (key) => ratings.length ? (ratings.reduce((sum, rating) => sum + Number(rating[key]), 0) / ratings.length).toFixed(1) : '—';
    const noShowRate = analytics.total ? Math.round(analytics.noShowAttempts / analytics.total * 100) : 0;
    const history = state.liveQueueHistory || [];
    const selected = analytics.queue.id;
    const options = history.map((queue) => `<option value="${queue.id}"${queue.id === selected ? ' selected' : ''}>${safeHtml(queue.booth_name)} · ${safeHtml(queue.queue_name)} (${queue.status})</option>`).join('');
    panel.innerHTML = `<div class="ticket-top"><span>HOST ANALYTICS</span><span>AGGREGATE ONLY</span></div><div class="field"><label>Saved queue</label><select onchange="selectAnalyticsQueue(this.value)">${options}</select></div><h2 style="font-size:22px;margin:18px 0">${safeHtml(analytics.queue.booth_name)} · ${safeHtml(analytics.queue.queue_name)}</h2><div class="metric-grid"><div class="metric"><b>${analytics.total}</b><span>Total queued</span></div><div class="metric"><b>${analytics.averageWaitMinutes === null ? '—' : `${Math.round(analytics.averageWaitMinutes)}m`}</b><span>Avg. wait</span></div><div class="metric"><b>${noShowRate}%</b><span>No-show rate</span></div></div><div class="privacy-callout"><b>Anonymous experience ratings</b><br>${ratings.length ? `${ratings.length} response${ratings.length === 1 ? '' : 's'} · Wait ${average('wait_score')}/5 · Service ${average('service_score')}/5 · Return ${average('return_score')}/5` : 'No ratings submitted yet.'}</div><p class="hint">Reports use counts, timings, and combined rating scores only—never names, phone numbers, email addresses, secret codes, or device identifiers.</p><div class="buttons"><button class="button primary" onclick="startNewLiveQueue()">Start a new queue</button><button class="button" onclick="goTo('organizer')">Back to host</button></div>`;
  }

  function safeHtml(value) {
    const node = document.createElement('span');
    node.textContent = String(value || '');
    return node.innerHTML;
  }

  const baseRender = window.render;
  window.render = () => {
    baseRender();
    const qrButton = document.querySelector('.host-actions button[onclick="goTo(\'print\')"]');
    if (qrButton) qrButton.textContent = 'QR code';
    const hostPanel = document.querySelector('#controlPanel');
    if (hostPanel && state.liveJoinCode && !hostPanel.querySelector('[data-live-queue-code]')) {
      const code = String(state.liveJoinCode).replace(/[^A-Z0-9]/g, '');
      const marker = document.querySelector('#controlPanel .schedule-chip');
      marker?.insertAdjacentHTML('afterend', `<p class="hint" data-live-queue-code><b>Live queue code:</b> <span class="code">${code}</span><br>Only people using this exact code or this Host QR appear in this queue.</p>`);
    }
    if (hostPanel && state.liveHostQueueId && !hostPanel.querySelector('[data-end-live-queue]')) {
      const actions = hostPanel.querySelector('.host-actions');
      actions?.insertAdjacentHTML('beforeend', '<button class="button danger" data-end-live-queue onclick="endLiveQueue()">End queue</button>');
    }
    renderLiveAnalytics();
    window.localizePage?.();
  };
  state.myTickets = savedTickets();
  window.render();

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const initialJoin = new URLSearchParams(window.location.search).get('join') || (pathParts[0] === 'join' ? pathParts[1] : '');
  if (initialJoin) setTimeout(() => window.openScannedQueue(initialJoin), 0);
  setInterval(() => {
    if (state.currentView === 'organizer') refreshHost();
    if (state.currentView === 'queuer') refreshTicket();
  }, 10000);
})();
