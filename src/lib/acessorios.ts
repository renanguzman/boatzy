import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

export type AcessorioOption = { id: string; nome: string };

/** Todos os acessórios cadastrados. */
export async function getTodosAcessorios(): Promise<AcessorioOption[]> {
  const { data, error } = await supabaseAdmin
    .from('acessorios')
    .select('id, nome')
    .order('nome');

  if (error) {
    console.error('[acessorios] falha ao carregar:', error);
    return [];
  }

  return data ?? [];
}
