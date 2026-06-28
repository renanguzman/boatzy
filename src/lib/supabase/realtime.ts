import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Garante que a conexão Realtime do client de browser use o JWT do usuário
 * logado (a sessão vem por cookie via @supabase/ssr).
 *
 * Sem isto, o socket do Realtime conecta como `anon` e a RLS de SELECT em
 * `mensagem` descarta TODOS os eventos de postgres_changes — ou seja, nada
 * chega em tempo real. Deve ser chamado (e aguardado) antes de `.subscribe()`.
 */
export async function authorizeRealtime(supabase: SupabaseClient<Database>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(session?.access_token ?? null);
}
