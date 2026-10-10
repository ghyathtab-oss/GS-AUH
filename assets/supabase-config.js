/** بيانات الاتصال العامة فقط؛ لا تضع service_role أو secret هنا أبداً. */
export const SUPABASE_URL = 'https://cpnadksppfngagtrhipc.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vsjzgBEKAsRHa4KKjI-c7w_ra3-5rDh';
export const SUPABASE_CONFIGURED = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 && !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');
export const STORAGE_BUCKET = 'medatlas-lectures';
