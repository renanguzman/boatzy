import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

export type EquipamentoSegurancaOption = { id: string; nome: string };

/** Todos os equipamentos de segurança cadastrados. */
export async function getTodosEquipamentosSeguranca(): Promise<EquipamentoSegurancaOption[]> {
  const { data, error } = await supabaseAdmin
    .from('equipamentos_seguranca')
    .select('id, nome')
    .order('nome');

  if (error) {
    console.error('[equipamentos-seguranca] falha ao carregar:', error);
    return [];
  }

  return data ?? [];
}
