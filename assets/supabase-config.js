/** بيانات الاتصال العامة فقط؛ لا تضع service_role أو secret هنا أبداً. */
export const SUPABASE_URL = 'PASTE_SUPABASE_PROJECT_URL';
export const SUPABASE_PUBLISHABLE_KEY = 'PASTE_SUPABASE_PUBLISHABLE_OR_ANON_KEY';
export const SUPABASE_CONFIGURED = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 && !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');
export const STORAGE_BUCKET = 'medatlas-lectures';
