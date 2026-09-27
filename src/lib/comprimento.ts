/**
 * Comprimento da embarcação — o gestor informa o valor em metros ou em pés
 * (padrão náutico comum para lanchas/iates). O banco grava o valor exatamente
 * como digitado em `embarcacao.comprimento` e a unidade em
 * `embarcacao.comprimento_unidade`; nada é convertido.
 *
 * Módulo puro (sem `server-only`): usado nos formulários do painel, nas
 * server actions e em todas as telas que exibem o comprimento.
 */

export type ComprimentoUnidade = 'm' | 'pes';

export const COMPRIMENTO_UNIDADES: { value: ComprimentoUnidade; label: string }[] = [
  { value: 'm',   label: 'Metros' },
  { value: 'pes', label: 'Pés' },
];

export function isComprimentoUnidade(v: unknown): v is ComprimentoUnidade {
  return v === 'm' || v === 'pes';
}

/** Valor + unidade → rótulo de exibição ("8,5 m", "28 pés", "1 pé"). null se vazio. */
export function formatarComprimento(
  valor: number | string | null | undefined,
  unidade: ComprimentoUnidade | string | null | undefined,
): string | null {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  const num = n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  if (unidade === 'pes') return `${num} ${n === 1 ? 'pé' : 'pés'}`;
  return `${num} m`;
}
