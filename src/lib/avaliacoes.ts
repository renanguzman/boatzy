import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

export type AvaliacaoResumo = { media: number; total: number };

/**
 * Média e total de avaliações por roteiro, em lote (uma query para todos os
 * ids listados). Roteiros sem avaliação não entram no Map — o card exibe o
 * badge "Novo" nesse caso.
 */
export async function getAvaliacoesResumoPorRoteiro(
  roteiroIds: string[],
): Promise<Map<string, AvaliacaoResumo>> {
  const resumo = new Map<string, AvaliacaoResumo>();
  if (roteiroIds.length === 0) return resumo;

  const { data, error } = await supabaseAdmin
    .from('avaliacao')
    .select('roteiro_id, nota')
    .in('roteiro_id', roteiroIds)
    .eq('status', 'aprovada');

  if (error) {
    console.error('[avaliacoes] falha ao agregar resumo:', error);
    return resumo;
  }

  const somas = new Map<string, { soma: number; total: number }>();
  for (const row of data ?? []) {
    if (!row.roteiro_id) continue;
    const atual = somas.get(row.roteiro_id) ?? { soma: 0, total: 0 };
    atual.soma += row.nota;
    atual.total += 1;
    somas.set(row.roteiro_id, atual);
  }

  for (const [roteiroId, { soma, total }] of somas) {
    resumo.set(roteiroId, { media: soma / total, total });
  }
  return resumo;
}

/**
 * Média e total de avaliações por embarcação, em lote (inclui avaliações de
 * roteiros feitos na embarcação — avaliacao.embarcacao_id). Embarcações sem
 * avaliação não entram no Map — o card exibe o badge "Novo" nesse caso.
 */
export async function getAvaliacoesResumoPorEmbarcacao(
  embarcacaoIds: string[],
): Promise<Map<string, AvaliacaoResumo>> {
  const resumo = new Map<string, AvaliacaoResumo>();
  if (embarcacaoIds.length === 0) return resumo;

  const { data, error } = await supabaseAdmin
    .from('avaliacao')
    .select('embarcacao_id, nota')
    .in('embarcacao_id', embarcacaoIds)
    .eq('status', 'aprovada');

  if (error) {
    console.error('[avaliacoes] falha ao agregar resumo por embarcação:', error);
    return resumo;
  }

  const somas = new Map<string, { soma: number; total: number }>();
  for (const row of data ?? []) {
    if (!row.embarcacao_id) continue;
    const atual = somas.get(row.embarcacao_id) ?? { soma: 0, total: 0 };
    atual.soma += row.nota;
    atual.total += 1;
    somas.set(row.embarcacao_id, atual);
  }

  for (const [embarcacaoId, { soma, total }] of somas) {
    resumo.set(embarcacaoId, { media: soma / total, total });
  }
  return resumo;
}
