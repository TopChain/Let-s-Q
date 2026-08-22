/*
 * Public runtime configuration. Database credentials stay in the Netlify
 * Function environment and are never bundled into the web or mobile app.
 */
window.LETS_Q_CONFIG = {
  demoMode: false,
  publicAppUrl: 'https://soft-bonbon-62fdc2.netlify.app',
  apiBaseUrl: 'https://soft-bonbon-62fdc2.netlify.app/.netlify/functions/letsq-api'
};

/*
 * Keep empty fields visually empty. The app shell renders some views
 * dynamically, so remove placeholder/example copy both now and whenever a
 * field is added or a placeholder is assigned later.
 */
(() => {
  const stripPlaceholder = (node) => {
    if (!(node instanceof Element)) return;
    if (node.matches('input[placeholder], textarea[placeholder]')) {
      node.removeAttribute('placeholder');
    }
    node.querySelectorAll?.('input[placeholder], textarea[placeholder]').forEach((field) => {
      field.removeAttribute('placeholder');
    });
  };

  const start = () => {
    stripPlaceholder(document.documentElement);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          stripPlaceholder(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach(stripPlaceholder);
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['placeholder']
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
