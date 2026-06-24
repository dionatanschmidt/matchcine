import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseReady =
  url.length > 0 &&
  !url.startsWith('COLOQUE') &&
  key.length > 0 &&
  !key.startsWith('COLOQUE');

export const supabase = createClient(
  supabaseReady ? url : 'https://placeholder.supabase.co',
  supabaseReady ? key : 'anon-placeholder'
);
