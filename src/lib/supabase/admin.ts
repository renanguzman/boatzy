import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const supabaseAdmin = serviceRoleKey
  ? createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  : (null as unknown as ReturnType<typeof createClient<Database>>);
