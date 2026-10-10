import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_CONFIGURED } from './supabase-config.js';
let clientPromise;
export async function getSupabase() {
  if (!SUPABASE_CONFIGURED) throw new Error('لم يتم ربط Supabase. راجع ملف SUPABASE_SETUP_AR.md');
  if (!clientPromise) clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    }));
  return clientPromise;
}
export function safeSlug(value) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || ''); }
