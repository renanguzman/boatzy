/**
 * Contrato de querystring de /buscar — compartilhado entre a página (Server
 * Component, que lê `searchParams`) e os controles de filtro/ordenação
 * (Client Components, que recebem os params por prop e navegam com
 * `router.push`). Módulo puro, sem `server-only`.
 */

export type BuscaSearchParams = {
  municipio?: string;
  local?: string;
  lat?: string;
  lng?: string;
  data?: string;
  flex?: string;
  pessoas?: string;
  pagina?: string;
  /** Aba ativa da busca ('embarcacao' exibe o seletor de tipo). */
  tipo?: string;
  /** Filtro por tipo de embarcação (uuid de embarcacao_tipo). */
  tipo_embarcacao?: string;
  /** Rótulo do tipo para chip/título (evita query extra). */
  tipo_nome?: string;
  /** Faixa de preço (preco_base), em reais. */
  preco_min?: string;
  preco_max?: string;
  /** Faixa de duração do passeio, em horas (1 dia = 24h). */
  duracao_min?: string;
  duracao_max?: string;
  /** Critério de ordenação — ver ORDENACOES. */
  ordenar?: string;
};

export const ORDENACOES = [
  { value: 'relevancia', label: 'Relevância' },
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'avaliacao', label: 'Melhor avaliação' },
  { value: 'preco_asc', label: 'Menor preço' },
  { value: 'preco_desc', label: 'Maior preço' },
  { value: 'duracao_asc', label: 'Menor duração' },
  { value: 'duracao_desc', label: 'Maior duração' },
] as const;

export type Ordenacao = (typeof ORDENACOES)[number]['value'];

export const ORDENACAO_PADRAO: Ordenacao = 'relevancia';

/** Valida o param `ordenar` vindo da URL (qualquer lixo cai no padrão). */
export function normalizarOrdenacao(valor: string | undefined): Ordenacao {
  const encontrada = ORDENACOES.find((o) => o.value === valor);
  return encontrada ? encontrada.value : ORDENACAO_PADRAO;
}

/** Número positivo vindo da URL; qualquer outra coisa vira null (= sem filtro). */
export function parseNumeroPositivo(valor: string | undefined): number | null {
  if (!valor) return null;
  const n = parseFloat(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Monta a URL de /buscar a partir dos params atuais + alterações.
 * Chave com valor vazio/undefined é removida da querystring.
 */
export function buildBuscarUrl(
  atuais: BuscaSearchParams,
  alteracoes: Partial<Record<keyof BuscaSearchParams, string | null | undefined>>,
): string {
  const merged: Record<string, string | null | undefined> = { ...atuais, ...alteracoes };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/buscar?${qs}` : '/buscar';
}

/** Quantos filtros avançados (preço/duração) estão ativos. */
export function contarFiltrosAvancados(params: BuscaSearchParams): number {
  let n = 0;
  if (params.preco_min || params.preco_max) n++;
  if (params.duracao_min || params.duracao_max) n++;
  return n;
}
