import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * Client-side Supabase client (anon key, respects RLS).
 * Use in Client Components and public API routes.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Supabase client (service role key, bypasses RLS).
 * Use only in Server Actions and server-only API routes.
 * Never expose this to the browser.
 */
export const supabaseAdmin = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  : (null as unknown as ReturnType<typeof createClient<Database>>);
