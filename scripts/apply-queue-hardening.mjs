import fs from 'node:fs';

const path = 'live-queue.js';
let source = fs.readFileSync(path, 'utf8');

const oldRefresh = `  async function refreshTicket(showError = false) {
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
  }`;

const newRefresh = `  async function refreshTicket(showError = false) {
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
    const publicId = current.public_queue_id || ticket.publicId;
    const updatedTicket = {
      ...ticket,
      publicId,
      status: current.status,
      ticketNumber: current.ticket_number,
      boothName: current.booth_name,
      queueName: current.queue_name
    };
    upsertTicket(updatedTicket);
    state.selectedLiveTicket = updatedTicket.accessToken;
    state.livePublicQueueId = publicId;
    state.liveJoinCode = current.join_code || state.liveJoinCode;
    state.my = { n: current.ticket_number, code: updatedTicket.code, state: current.status, attempts: 0, note: '' };
    state.booth = current.booth_name;
    state.queue = current.queue_name;
    state.now = Number(current.now_serving || 0);
    state.aheadCount = Number(current.ahead_count || 0);
    window.render();
    return true;
  }`;

if (!source.includes(oldRefresh)) throw new Error('refreshTicket source block no longer matches; refusing a blind edit.');
source = source.replace(oldRefresh, newRefresh);

const oldPoll = `  setInterval(() => {
    if (state.currentView === 'organizer') refreshHost();
    if (state.currentView === 'queuer') refreshTicket();
  }, 10000);`;

const newPoll = `  // Keep Host controls responsive, but do not spend network/database work while
  // the app is backgrounded. Queuer status can tolerate a slightly slower poll;
  // each refresh is now a single get_my_ticket RPC instead of two RPCs.
  setInterval(() => {
    if (document.hidden) return;
    if (state.currentView === 'organizer') refreshHost();
  }, 10000);
  setInterval(() => {
    if (document.hidden) return;
    if (state.currentView === 'queuer') refreshTicket();
  }, 15000);`;

if (!source.includes(oldPoll)) throw new Error('polling source block no longer matches; refusing a blind edit.');
source = source.replace(oldPoll, newPoll);

fs.writeFileSync(path, source);
console.log('Applied Let’s Q queue hardening.');
