function hideControl(button) {
  button.hidden = true;
  button.setAttribute('aria-hidden', 'true');
  button.style.setProperty('display', 'none', 'important');
}

function hideUnimplementedControls() {
  const selectors = [
    'button[onclick*="openModal(\'staff\')"]',
    'button[onclick*="openModal(\'settings\')"]'
  ];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach(hideControl);
  }
}

function hideUnsupportedTicketSharing() {
  document.querySelectorAll('#screen-queuer .ticket-actions button').forEach(button => {
    if (button.textContent.trim() !== 'Share ticket') return;
    hideControl(button);
  });
}

function isNativeIos() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.()) && window.Capacitor?.getPlatform?.() === 'ios';
  } catch {
    return false;
  }
}

function installIosViewportLayout() {
  if (!isNativeIos() || document.getElementById('letsq-ios-viewport-fix')) return;
  const style = document.createElement('style');
  style.id = 'letsq-ios-viewport-fix';
  style.textContent = `
    :root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:max(14px,env(safe-area-inset-bottom));--ios-nav-height:calc(66px + var(--safe-bottom));--ios-promo-height:58px}
    html,body{width:100%!important;height:100%!important;min-height:100%!important;overflow:hidden!important}
    .desktop-wrap{position:fixed!important;inset:0!important;display:block!important;min-height:0!important;padding:0!important;background:var(--cloud)!important}
    .brand-board{display:none!important}.phone{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;height:100dvh!important;min-height:0!important;border:0!important;border-radius:0!important;max-width:none!important;overflow:hidden!important}.phone:before{display:none!important}
    .app-shell{height:100%!important;height:100dvh!important;min-height:0!important}.topbar{flex:0 0 112px!important;padding-top:calc(10px + var(--safe-top))!important}.content{min-height:0!important;padding-bottom:calc(var(--ios-nav-height) + var(--ios-promo-height) + 24px)!important}
    .bottom-nav{position:fixed!important;top:auto!important;bottom:0!important;left:0!important;right:0!important;height:var(--ios-nav-height)!important;padding:8px max(8px,env(safe-area-inset-right)) var(--safe-bottom) max(8px,env(safe-area-inset-left))!important;align-items:end!important}
    .ad-banner{position:fixed!important;top:auto!important;left:8px!important;right:8px!important;bottom:var(--ios-nav-height)!important;min-height:var(--ios-promo-height)!important;border-radius:16px 16px 0 0!important;background:linear-gradient(110deg,#eaf4ff,#f0fdfa)!important;color:#0f2a57!important;border:1px solid #bfdbfe!important;box-shadow:0 -8px 20px #0f172a14!important}
    .ad-banner .ad-badge{background:#dbeafe!important;color:#075fe3!important}.ad-banner .ad-copy span{color:#475569!important}.ad-banner .ad-close{background:#fff!important;color:#075fe3!important;border:1px solid #bfdbfe!important}
    .toast{position:fixed!important;bottom:calc(var(--ios-nav-height) + var(--ios-promo-height) + 12px)!important}.modal-backdrop,.full-ad{position:fixed!important}
  `;
  document.head.append(style);
}

function replaceIosAdFallback() {
  if (!isNativeIos()) return;
  clearInterval(window.letsQAdTimer);
  document.getElementById('fullAd')?.classList.remove('show');
  const banner = document.getElementById('stickyAdBanner');
  if (!banner) return;
  banner.setAttribute('aria-label', 'Let’s Q tip');
  banner.innerHTML = '<span class="ad-badge">LET’S Q TIP</span><div class="ad-copy"><b>Hosts: show the queue QR at your counter</b><span>Queuers can scan or enter the short code — no account required.</span></div><button class="ad-close" onclick="showToast(\'Let’s Q uses this space for helpful tips when no ad is available.\')">ⓘ</button>';
}

installIosViewportLayout();

function ensureWebAdShell() {
  if (window.Capacitor?.isNativePlatform?.()) return;
  const nav = document.querySelector('.bottom-nav');
  const shell = document.querySelector('.app-shell, .phone') || nav?.parentElement || document.querySelector('.desktop-wrap');
  if (!shell) return;

  if (!document.getElementById('stickyAdBanner')) {
    const banner = document.createElement('aside');
    banner.id = 'stickyAdBanner';
    banner.className = 'ad-banner';
    banner.setAttribute('aria-label', 'Sponsored content');
    banner.innerHTML = '<span class="ad-badge">AD</span><div class="ad-copy"><b>Make your next wait feel shorter</b><span>Sponsored · Let’s Q never gives advertisers your queue code or private request.</span></div><button class="ad-close" onclick="showToast(\'Privacy choices are available from the app menu.\')">ⓘ</button>';
    if (nav?.parentElement) nav.parentElement.insertBefore(banner, nav);
    else shell.appendChild(banner);
  }

  if (!document.getElementById('fullAd')) {
    const overlay = document.createElement('section');
    overlay.id = 'fullAd';
    overlay.className = 'full-ad';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    shell.appendChild(overlay);
  }
}

function resumeInterruptedStartup() {
  window.renderQueueList?.();
  window.renderHostQueue?.();
  window.openLinkedQueue?.();
}

function hardenIosReportMonetization() {
  if (!isNativeIos()) return;
  const paywall = document.getElementById('reportPaywall');
  if (!paywall) return;

  for (const button of paywall.querySelectorAll('button:not([data-ios-report-button])')) hideControl(button);

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
  installIosViewportLayout();
  replaceIosAdFallback();
  ensureWebAdShell();
  resumeInterruptedStartup();
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
