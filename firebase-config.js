// Compatibility configuration for the current app.html.
// The global name is kept so the existing UI can be migrated without editing
// the 2 MB HTML bundle in place. This file contains no database credential.
// Legacy global name retained because app.html still loads this file. Queue
// operations now go through the Neon-backed Let’s Q API.
window.LetsQFirebaseConfig = {
  publicAppUrl: 'https://soft-bonbon-62fdc2.netlify.app',
  apiBaseUrl: 'https://soft-bonbon-62fdc2.netlify.app/.netlify/functions/letsq-api'
};
