/**
 * Contrato de querystring de /vendas — compartilhado entre a página (Server
 * Component) e o painel de filtros (Client Component). Módulo puro.
 */
export type VendasSearchParams = {
  tipo?: string;
  estado?: string;
  cidade?: string;
  ano_min?: string;
  ano_max?: string;
  preco_min?: string;
  preco_max?: string;
  pagina?: string;
};

/** Monta a URL de /vendas a partir dos params atuais + alterações (vazio = removido). */
export function buildVendasUrl(
  atuais: VendasSearchParams,
  alteracoes: Partial<Record<keyof VendasSearchParams, string | null | undefined>> = {},
): string {
  const merged: Record<string, string | null | undefined> = { ...atuais, ...alteracoes };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/vendas?${qs}` : '/vendas';
}
