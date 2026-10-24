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

export type AvaliacaoDestaque = {
  id: string;
  comentario: string;
  created_at: string;
  /** "Ana S." — primeiro nome + inicial do último, para a vitrine da home. */
  autor: string;
  avatarUrl: string | null;
  roteiro: { id: string; nome: string; localidade: string | null } | null;
};

/** "Ana Souza Lima" → "Ana L."; um nome só fica como está. */
function nomeCurto(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Cliente Boatzy';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}

/**
 * Avaliações nota 5, aprovadas e com comentário, mais recentes primeiro — a
 * seção "Quem navegou, recomenda" da home. Só de roteiros ativos (o card leva
 * ao roteiro); sem nenhuma, a seção não aparece.
 */
export async function getAvaliacoesCincoEstrelas(limit = 6): Promise<AvaliacaoDestaque[]> {
  const { data, error } = await supabaseAdmin
    .from('avaliacao')
    .select('id, comentario, created_at, roteiro_id, cliente:users!avaliacao_cliente_id_fkey ( name, avatar_url )')
    .eq('status', 'aprovada')
    .eq('nota', 5)
    .not('roteiro_id', 'is', null)
    .not('comentario', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit * 3); // folga para descartar comentário vazio e roteiro inativo

  if (error) {
    console.error('[avaliacoes] falha ao buscar avaliações 5 estrelas:', error);
    return [];
  }

  type Linha = {
    id: string;
    comentario: string | null;
    created_at: string;
    roteiro_id: string | null;
    cliente: { name: string | null; avatar_url: string | null } | null;
  };
  const linhas = ((data ?? []) as unknown as Linha[]).filter((a) => a.comentario?.trim());
  if (linhas.length === 0) return [];

  const { data: roteiros } = await supabaseAdmin
    .from('roteiro')
    .select('id, nome, municipios ( nome, estados ( uf ) )')
    .in('id', [...new Set(linhas.map((a) => a.roteiro_id!))])
    .eq('ativo', true);
  type RoteiroLinha = { id: string; nome: string; municipios: { nome: string; estados: { uf: string } | null } | null };
  const roteiroPorId = new Map(((roteiros ?? []) as unknown as RoteiroLinha[]).map((r) => [r.id, r]));

  return linhas
    .flatMap((a) => {
      const r = roteiroPorId.get(a.roteiro_id!);
      if (!r) return [];
      const localidade = r.municipios
        ? r.municipios.estados ? `${r.municipios.nome}, ${r.municipios.estados.uf}` : r.municipios.nome
        : null;
      return [{
        id: a.id,
        comentario: a.comentario!.trim(),
        created_at: a.created_at,
        autor: nomeCurto(a.cliente?.name),
        avatarUrl: a.cliente?.avatar_url ?? null,
        roteiro: { id: r.id, nome: r.nome, localidade },
      }];
    })
    .slice(0, limit);
}
