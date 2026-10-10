import type { ReservaModalidadePreco } from '@/types/supabase';

/**
 * Exibição do preço de um roteiro no padrão "A partir de R$ X".
 *
 * O preço varia por data (`roteiro_preco_regra`) e por modelo de cobrança
 * ativo, então o card nunca anuncia um valor fechado: mostra o menor preço
 * alcançável (`roteiro.preco_minimo`, materializado por trigger) e deixa
 * explícito que depende da data escolhida. A unidade vem de
 * `preco_minimo_modelo`, porque um mínimo de R$ 150 significa coisas bem
 * diferentes por dia e por pessoa.
 */

export type PrecoMinimoRoteiro = {
  preco_minimo: number | null;
  preco_minimo_modelo: ReservaModalidadePreco | null;
};

export type PrecoExibicao = {
  valor: number;
  /** Sufixo da unidade, já com a barra: '/dia', '/diária' ou '/pessoa'. */
  unidade: string;
};

const UNIDADE: Record<ReservaModalidadePreco, string> = {
  roteiro: '/dia',
  diaria: '/diária',
  pessoa: '/pessoa',
};

export function formatarPreco(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor);
}

/** `null` quando o roteiro não tem nenhum preço configurado. */
export function precoExibicaoRoteiro(r: PrecoMinimoRoteiro): PrecoExibicao | null {
  if (r.preco_minimo == null) return null;
  return {
    valor: r.preco_minimo,
    unidade: UNIDADE[r.preco_minimo_modelo ?? 'roteiro'],
  };
}
