import type { LocalidadeVendaValue } from './LocalidadeVendaPicker';
import type { TipoVendaOption } from './TipoVendaPicker';
import type { AnoVendaValue } from './AnoVendaPicker';
import type { ValorVendaValue } from './ValorVendaPicker';

export type VendaSearchState = {
  tipo: TipoVendaOption | null;
  localidade: LocalidadeVendaValue | null;
  ano: AnoVendaValue;
  valor: ValorVendaValue;
};

/** Monta a URL de resultados /vendas a partir do estado da barra de busca. */
export function buildVendaSearchUrl(state: VendaSearchState): string {
  const params = new URLSearchParams();
  if (state.tipo) params.set('tipo', state.tipo.id);
  if (state.localidade) {
    params.set('estado', String(state.localidade.estadoId));
    if (state.localidade.municipioId != null) {
      params.set('cidade', String(state.localidade.municipioId));
    }
  }
  if (state.ano.min) params.set('ano_min', state.ano.min);
  if (state.ano.max) params.set('ano_max', state.ano.max);
  if (state.valor.min) params.set('preco_min', state.valor.min);
  if (state.valor.max) params.set('preco_max', state.valor.max);
  const qs = params.toString();
  return qs ? `/vendas?${qs}` : '/vendas';
}
