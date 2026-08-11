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

window.addEventListener('load', () => {
  hideUnimplementedControls();

  const previousOpenModal = window.openModal;
  if (typeof previousOpenModal === 'function') {
    window.openModal = function hardenedOpenModal(type) {
      if (type === 'staff' || type === 'settings') {
        window.showToast?.('This control is not enabled in the production release yet.');
        return;
      }
      previousOpenModal(type);
      if (type === 'walkin') replaceWalkInModal();
      if (type === 'closeQueue') clarifyCloseQueueModal();
    };
  }

  // Some Host controls are rendered again after startup; keep demo-only controls hidden.
  const observer = new MutationObserver(() => hideUnimplementedControls());
  observer.observe(document.body, { childList: true, subtree: true });
});
