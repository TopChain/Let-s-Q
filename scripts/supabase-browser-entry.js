import { createClient } from '@supabase/supabase-js';

// Keep the public client explicit instead of relying on a package-specific
// global name. This works consistently in browsers and Capacitor WebViews.
window.LetsQSupabase = { createClient };
