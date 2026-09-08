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
  /** Comodidades desejadas (ids separados por vírgula) — só na aba Embarcações. */
  comodidades?: string;
  /** Modelos de cobrança desejados ('roteiro'|'diaria'|'pessoa', separados por vírgula) — só na aba Roteiros. */
  modelo_preco?: string;
  /** Critério de ordenação — ver ORDENACOES. */
  ordenar?: string;
};

export const MODELOS_PRECO = [
  { value: 'roteiro', label: 'Passeios (Roteiro)' },
  { value: 'diaria', label: 'Por Diária' },
  { value: 'pessoa', label: 'Por Pessoa' },
] as const;

export type ModeloPreco = (typeof MODELOS_PRECO)[number]['value'];

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

/** Quantos filtros avançados (preço/duração/modelo de cobrança) estão ativos. */
export function contarFiltrosAvancados(params: BuscaSearchParams): number {
  let n = 0;
  if (params.preco_min || params.preco_max) n++;
  if (params.duracao_min || params.duracao_max) n++;
  if (params.modelo_preco) n++;
  return n;
}

/** Ids de comodidade selecionados na URL (`?comodidades=id1,id2`), sem vazios. */
export function parseComodidadeIds(valor: string | undefined): string[] {
  if (!valor) return [];
  return valor.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Modelos de cobrança selecionados na URL (`?modelo_preco=roteiro,diaria`), só valores válidos. */
export function parseModelosPreco(valor: string | undefined): ModeloPreco[] {
  if (!valor) return [];
  const validos = new Set(MODELOS_PRECO.map((m) => m.value));
  return valor
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is ModeloPreco => validos.has(v as ModeloPreco));
}
