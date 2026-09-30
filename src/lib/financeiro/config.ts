import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

export type FormaPagamento = Database['public']['Tables']['forma_pagamento']['Row'];
export type FinanceiroConfig = Database['public']['Tables']['financeiro_config']['Row'];

/** Formas de pagamento em ordem de exibição (inclui as inativas — filtre `ativo` no checkout). */
export async function getFormasPagamento(): Promise<FormaPagamento[]> {
  const { data, error } = await supabaseAdmin.from('forma_pagamento').select('*').order('ordem');
  if (error) throw new Error(`Falha ao ler formas de pagamento: ${error.message}`);
  return data ?? [];
}

/** Parâmetros do financeiro (singleton criado pela migration 20260930b). */
export async function getFinanceiroConfig(): Promise<FinanceiroConfig> {
  const { data, error } = await supabaseAdmin.from('financeiro_config').select('*').eq('singleton', true).single();
  if (error || !data) throw new Error(`Falha ao ler financeiro_config: ${error?.message ?? 'sem registro'}`);
  return data;
}
