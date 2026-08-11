// Compatibility configuration for the current app.html.
// The global name is kept so the existing UI can be migrated without editing
// the 2 MB HTML bundle in place. Queue data is now served by Supabase, not Firebase.
// This is a public browser key. Never put a service-role key or other secret here.
window.LetsQFirebaseConfig = {
  supabaseUrl: 'https://exqsdvzgoivacpqqdott.supabase.co',
  supabaseAnonKey: 'sb_publishable_GhOAIYMrWBJutq6Y8SJoyQ_Q4ZcPQk1'
};
