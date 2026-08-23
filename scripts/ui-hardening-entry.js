function hideUnimplementedControls() {
  const selectors = [
    'button[onclick*="openModal(\'staff\')"]',
    'button[onclick*="openModal(\'settings\')"]'
  ];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach(button => {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
    });
  }
}

function hideUnsupportedTicketSharing() {
  document.querySelectorAll('#screen-queuer .ticket-actions button').forEach(button => {
    if (button.textContent.trim() !== 'Share ticket') return;
    button.hidden = true;
    button.setAttribute('aria-hidden', 'true');
  });
}

function isNativeIos() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.()) && window.Capacitor?.getPlatform?.() === 'ios';
  } catch {
    return false;
  }
}

function hardenIosReportMonetization() {
  if (!isNativeIos()) return;
  const paywall = document.getElementById('reportPaywall');
  if (!paywall) return;

  for (const button of paywall.querySelectorAll('button:not([data-ios-report-button])')) button.hidden = true;

  if (!paywall.querySelector('[data-ios-report-note]')) {
    const note = document.createElement('div');
    note.dataset.iosReportNote = 'true';
    note.className = 'privacy-strip';
    note.innerHTML = '<span class="privacy-lock">✓</span><span><b>Q Report is included on iPhone in this build.</b>No subscription or ad is required until native iOS billing and ads are enabled.</span>';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.iosReportButton = 'true';
    button.className = 'btn primary wide';
    button.textContent = 'View report';
    button.onclick = () => {
      const state = typeof appState !== 'undefined' ? appState : null;
      if (state) state.reportUnlocked = true;
      window.renderReport?.();
      window.renderLetsQReport?.();
    };
    paywall.append(note, button);
  }
}

function removePrototypeMetrics() {
  document.querySelectorAll('.activity-row').forEach(row => {
    if (row.textContent.includes('Last event report is ready')) row.remove();
  });
  document.querySelectorAll('#screen-host .stat-card').forEach(card => {
    if (card.querySelector('span')?.textContent === 'Avg wait') card.querySelector('b').textContent = '—';
  });
  const reportSubtitle = document.querySelector('#screen-report > .subtitle');
  if (reportSubtitle) reportSubtitle.textContent = 'Your current Host queue · anonymous totals';
}

function initializeHostSchedule() {
  const start = document.getElementById('startTime');
  const end = document.getElementById('endTime');
  if (!start || !end) return;
  const current = new Date();
  if (start.value && new Date(start.value).getTime() > current.getTime()) return;
  current.setMinutes(current.getMinutes() < 30 ? 30 : 60, 0, 0);
  const finish = new Date(current.getTime() + 8 * 60 * 60 * 1000);
  const localValue = value => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  start.value = localValue(current);
  end.value = localValue(finish);
}

function rewriteVisibleLegacyCopy() {
  const queuerCopy = document.querySelector('.home-actions .role-card p');
  if (queuerCopy) queuerCopy.textContent = 'Scan or enter a queue code.';
  const hostReference = document.querySelector('.host-now .secret');
  if (hostReference) hostReference.innerHTML = 'Guest reference: <b id="hostSecret">Anonymous guest</b>';
  const previousShowToast = window.showToast;
  if (typeof previousShowToast === 'function' && !previousShowToast.__letsqNeonCopy) {
    const hardenedToast = message => previousShowToast(
      String(message || '').includes('Finish Firebase setup')
        ? 'The queue service is unavailable. Please try again shortly.'
        : message
    );
    hardenedToast.__letsqNeonCopy = true;
    window.showToast = hardenedToast;
  }
}

function replacePrivacyModal() {
  const content = document.getElementById('modalContent');
  if (!content) return;
  content.innerHTML = `<div class="modal-handle"></div><div class="modal-head"><h3>Your privacy in Let’s Q</h3><button class="modal-close" onclick="closeModal()">×</button></div><div class="privacy-strip"><span class="privacy-lock">🔒</span><span><b>Anonymous by default</b>Guests join with a ticket number and a private passphrase—never a name, phone number, email, account, or profile.</span></div><div class="stack"><div class="card" style="margin:0"><b style="font-size:13px">What hosts can see</b><p class="subtitle" style="margin:6px 0 0">Ticket number and an optional service note supplied by the guest.</p></div><div class="card" style="margin:0"><b style="font-size:13px">What reports contain</b><p class="subtitle" style="margin:6px 0 0">Only aggregate counts, timing, and anonymous satisfaction scores.</p></div><div class="card" style="margin:0"><b style="font-size:13px">How it connects</b><p class="subtitle" style="margin:6px 0 0">Queue data is sent over encrypted connections and stored by Netlify and Neon.</p></div></div><button class="btn primary wide" style="margin-top:14px" onclick="closeModal()">Got it</button>`;
}

function replaceWalkInModal() {
  const content = document.getElementById('modalContent');
  if (!content) return;
  content.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-head"><h3>Add walk-in ticket</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <p class="subtitle">For a visitor without a smartphone. A real anonymous ticket number is assigned only after you press Create.</p>
    <div class="privacy-strip"><span class="privacy-lock">🔒</span><span><b>No contact information required</b>The walk-in follows the same queue and no-show rules.</span></div>
    <button class="btn primary wide" type="button" onclick="addWalkin()">Create walk-in ticket</button>`;
}

function clarifyCloseQueueModal() {
  const content = document.getElementById('modalContent');
  if (!content) return;
  const title = content.querySelector('h3');
  const subtitle = content.querySelector('.subtitle');
  const textareaField = content.querySelector('.field');
  const button = Array.from(content.querySelectorAll('button')).find(item => item.textContent.includes('Close queue'));
  if (title) title.textContent = 'Close queue early';
  if (subtitle) subtitle.textContent = 'Closing stops new joins and cancels every remaining active ticket. This release does not send push notifications, so do not promise a notification message.';
  if (textareaField) textareaField.hidden = true;
  if (button) button.textContent = 'Close queue';
}

function hardenCancelModal() {
  const ticketNumber = document.getElementById('ticketNumber')?.textContent?.trim();
  const subtitle = document.querySelector('#modalContent .subtitle');
  if (!ticketNumber || !subtitle) return;
  subtitle.textContent = `Ticket ${ticketNumber} will be cancelled and its number will never be reassigned.`;
}

window.addEventListener('load', () => {
  hideUnimplementedControls();
  hideUnsupportedTicketSharing();
  hardenIosReportMonetization();
  removePrototypeMetrics();
  initializeHostSchedule();
  rewriteVisibleLegacyCopy();

  const previousOpenModal = window.openModal;
  if (typeof previousOpenModal === 'function') {
    window.openModal = function hardenedOpenModal(type) {
      if (type === 'staff' || type === 'settings' || type === 'share') {
        window.showToast?.('This control is not enabled in the production release yet.');
        return;
      }
      previousOpenModal(type);
      if (type === 'cancel') hardenCancelModal();
      if (type === 'privacy') replacePrivacyModal();
      if (type === 'walkin') replaceWalkInModal();
      if (type === 'closeQueue') clarifyCloseQueueModal();
    };
  }

  // Some Host/report controls are rendered again after startup; keep production
  // truthfulness guards applied after every render.
  const observer = new MutationObserver(() => {
    hideUnimplementedControls();
    hideUnsupportedTicketSharing();
    hardenIosReportMonetization();
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
