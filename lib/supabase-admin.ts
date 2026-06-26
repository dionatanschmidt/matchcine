import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const adminReady =
  url.length > 0 && !url.startsWith('COLOQUE') &&
  key.length > 0 && !key.startsWith('COLOQUE');

export const supabaseAdmin = createClient(
  adminReady ? url : 'https://placeholder.supabase.co',
  adminReady ? key : 'placeholder-service-key',
  { auth: { autoRefreshToken: false, persistSession: false } }
);
