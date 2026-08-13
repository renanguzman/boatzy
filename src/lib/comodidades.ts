import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

export type ComodidadeOption = { id: string; nome: string };

/** Todas as comodidades cadastradas — alimenta o filtro de comodidades da busca. */
export async function getTodasComodidades(): Promise<ComodidadeOption[]> {
  const { data, error } = await supabaseAdmin
    .from('comodidade')
    .select('id, nome')
    .order('nome');

  if (error) {
    console.error('[comodidades] falha ao carregar comodidades:', error);
    return [];
  }

  return data ?? [];
}
