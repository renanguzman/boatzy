import type { ReservaModalidadePreco } from '@/types/supabase';
import { formatarData } from '@/lib/datas';
import { IDIOMA_PADRAO, LOCALE_INTL, type Idioma } from '@/i18n/config';

/**
 * Exibição do preço de um roteiro no card: "A partir de R$ X" ou, quando o
 * cliente escolheu data, "Em 25/10 R$ X".
 *
 * Todo preço exibido ao cliente é o "Cliente paga" do painel: preço do gestor
 * + taxa de serviço efetiva do gestor, com a mesma conta do checkout
 * (`calcularValoresPedido`). O detalhe do roteiro e o checkout já mostravam
 * esse valor; o card passa a usar o mesmo (migration 20261019):
 *
 *  - sem data: `roteiro.preco_minimo_cliente` (campo computado — menor valor
 *    entre os dias reserváveis da janela, já com a taxa);
 *  - com data (± flex): `roteiro_preco_exibicao(id, data, flex)` — menor
 *    valor entre os dias reserváveis do intervalo, e a data dele.
 *
 * A unidade vem do modelo que originou o valor, porque um mínimo de R$ 150
 * significa coisas bem diferentes por dia e por diária.
 */

export type PrecoMinimoRoteiro = {
  /** "A partir de" já com a taxa (campo computado `preco_minimo_cliente`). null = sem preço. */
  preco_minimo_cliente: number | null;
  preco_minimo_modelo: ReservaModalidadePreco | null;
};

/** Preço do roteiro na data escolhida pelo cliente, já com a taxa (`roteiro_preco_exibicao`). */
export type PrecoNaData = {
  valor: number;
  modelo: ReservaModalidadePreco;
  /** Dia a que o valor se refere ('AAAA-MM-DD') — com flex, o mais barato do intervalo. */
  data: string;
};

export type PrecoExibicao = {
  valor: number;
  /** Sufixo da unidade, já com a barra: '/passeio', '/diária' ou '/pessoa' (pt-BR). */
  unidade: string;
  /** Texto acima do valor: 'a partir de' ou 'em 25/10' (pt-BR). */
  rotulo: string;
  /** Modelo e data de origem — o site monta unidade e rótulo no idioma (`useFormatos`). */
  modelo: ReservaModalidadePreco;
  /** Dia do valor ('AAAA-MM-DD') quando há data escolhida; null = "a partir de". */
  data: string | null;
};

const UNIDADE: Record<ReservaModalidadePreco, string> = {
  // Modelo Roteiro: o valor é do passeio inteiro (o barco), não por dia nem por pessoa.
  roteiro: '/passeio',
  diaria: '/diária',
  pessoa: '/pessoa',
};

export function formatarPreco(valor: number, idioma: Idioma = IDIOMA_PADRAO): string {
  return new Intl.NumberFormat(LOCALE_INTL[idioma], {
    style: 'currency',
    currency: 'BRL',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(valor);
}

/** 'em 25/10' — data só de dia, formatada no fuso de Brasília. */
export function rotuloNaData(data: string): string {
  return `em ${formatarData(data, { day: '2-digit', month: '2-digit' })}`;
}

/**
 * `null` quando o roteiro não tem nenhum preço configurado. Com `naData`, o
 * valor da data escolhida tem precedência sobre o "a partir de".
 */
export function precoExibicaoRoteiro(
  r: PrecoMinimoRoteiro,
  naData?: PrecoNaData | null,
): PrecoExibicao | null {
  if (naData) {
    return {
      valor: naData.valor,
      unidade: UNIDADE[naData.modelo],
      rotulo: rotuloNaData(naData.data),
      modelo: naData.modelo,
      data: naData.data,
    };
  }
  if (r.preco_minimo_cliente == null) return null;
  const modelo = r.preco_minimo_modelo ?? 'roteiro';
  return {
    valor: Number(r.preco_minimo_cliente),
    unidade: UNIDADE[modelo],
    rotulo: 'a partir de',
    modelo,
    data: null,
  };
}

/**
 * Link do detalhe do roteiro com os filtros da busca (`query`: data/flex/
 * pessoas). Com preço na data, o link leva essa data — o detalhe abre nela e
 * mostra o mesmo valor do card (com flex, pode ser outro dia do intervalo).
 */
export function hrefRoteiro(id: string, query?: string, precoNaData?: PrecoNaData | null): string {
  const params = new URLSearchParams(query ?? '');
  if (precoNaData) params.set('data', precoNaData.data);
  const qs = params.toString();
  return qs ? `/roteiros/${id}?${qs}` : `/roteiros/${id}`;
}

function diasEntre(a: string, b: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round(Math.abs(utc(a) - utc(b)) / 86_400_000);
}

/**
 * ESPELHO de `roteiro_preco_exibicao` com data (migration 20261019), sobre o
 * calendário que o detalhe do roteiro já carrega: entre os dias disponíveis de
 * [data − flex, data + flex], o menor preço entre os modelos ativos — Roteiro
 * (preço do dia, só com `preco_base`) e Por Diária (fixo). Desempate: Roteiro,
 * depois o dia mais próximo da data pedida. Assim o detalhe abre no mesmo dia
 * e modelo que o card anunciou. Compara o preço do gestor: a taxa é a mesma
 * para todos os dias e modelos, então não muda a ordem. Se a regra mudar no
 * SQL, mude aqui também.
 */
export function escolherDiaDoPreco(params: {
  dias: { data: string; status: string; preco: number | null }[];
  data: string;
  flex: number;
  temModeloRoteiro: boolean;
  /** Valor da diária (gestor) quando o modelo Por Diária está ativo; senão null. */
  diaria: number | null;
}): { data: string; modelo: 'roteiro' | 'diaria' } | null {
  const flex = Math.min(Math.max(params.flex, 0), 31);
  type Candidato = { valor: number; ordem: number; distancia: number; data: string; modelo: 'roteiro' | 'diaria' };
  const candidatos: Candidato[] = [];
  for (const d of params.dias) {
    if (d.status !== 'disponivel') continue;
    const distancia = diasEntre(d.data, params.data);
    if (distancia > flex) continue;
    if (params.temModeloRoteiro && d.preco != null && d.preco > 0) {
      candidatos.push({ valor: d.preco, ordem: 1, distancia, data: d.data, modelo: 'roteiro' });
    }
    if (params.diaria != null && params.diaria > 0) {
      candidatos.push({ valor: params.diaria, ordem: 2, distancia, data: d.data, modelo: 'diaria' });
    }
  }
  candidatos.sort((a, b) =>
    a.valor - b.valor || a.ordem - b.ordem || a.distancia - b.distancia || a.data.localeCompare(b.data));
  const melhor = candidatos[0];
  return melhor ? { data: melhor.data, modelo: melhor.modelo } : null;
}

/**
 * Linha de `roteiro_preco_exibicao` / colunas `preco_exibicao*` de
 * `buscar_roteiros` → `PrecoNaData`. null quando não há data (é o "a partir
 * de") ou o roteiro não tem dia reservável com preço no intervalo.
 */
export function precoNaDataDeLinha(linha: {
  preco: number | string | null;
  modelo: string | null;
  data: string | null;
} | null | undefined): PrecoNaData | null {
  if (!linha || linha.preco == null || !linha.data) return null;
  return {
    valor: Number(linha.preco),
    modelo: (linha.modelo ?? 'roteiro') as ReservaModalidadePreco,
    data: linha.data,
  };
}
