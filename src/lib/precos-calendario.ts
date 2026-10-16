import { calcularValoresPedido } from '@/lib/pagamentos/valores';
import type { PrecoRegraTipo } from '@/types/supabase';

/**
 * Preço de cada dia do modelo "Roteiro", resolvido no navegador para o
 * calendário de preços do painel (`CalendarioPrecos`).
 *
 * `resolverPrecoNaData` é um ESPELHO da função SQL `get_preco_roteiro`
 * (migration 20261016) — a fonte da verdade que o site e o checkout usam. Existe
 * em TypeScript só para o gestor ver o efeito das regras ANTES de salvar. Se a
 * precedência mudar no SQL, mude aqui também. Datas trafegam como 'yyyy-mm-dd'
 * e a aritmética é em UTC (sem deslocamento de fuso).
 */

export type RegraPreco = {
  id: string;
  tipo: PrecoRegraTipo;
  nome: string;
  valor: number;
  prioridade: number;
  /** Regra inativa é ignorada, como no SQL. */
  ativo?: boolean;
  diasSemana?: number[] | null;
  periodoMesInicio?: number | null;
  periodoDiaInicio?: number | null;
  periodoMesFim?: number | null;
  periodoDiaFim?: number | null;
  dataInicio?: string | null;
  dataFim?: string | null;
};

/**
 * Tipos de regra criados no passo "Preços especiais". A data específica
 * (`data_fixa`) não está aqui: é criada clicando no dia do calendário.
 */
export type TipoRegraRecorrente = Exclude<PrecoRegraTipo, 'data_fixa'>;

/** Nome gravado nas regras de data específica (preço definido no calendário). */
export const NOME_DATA_ESPECIFICA = 'Data específica';
/** Desempate entre datas específicas sobrepostas: a gravada pelo calendário vence. */
export const PRIORIDADE_DATA_ESPECIFICA = 100;

/** Regra como vem do banco (`roteiro_preco_regra`). */
export type RegraBanco = {
  id: string; nome: string; valor: number | string; tipo: string; prioridade: number; ativo: boolean;
  dias_semana: number[] | null;
  periodo_mes_inicio: number | null; periodo_dia_inicio: number | null;
  periodo_mes_fim: number | null; periodo_dia_fim: number | null;
  data_inicio: string | null; data_fim: string | null;
};

export function regraDeBanco(r: RegraBanco): RegraPreco {
  return {
    id: r.id, tipo: r.tipo as PrecoRegraTipo, nome: r.nome, valor: Number(r.valor),
    prioridade: r.prioridade, ativo: r.ativo,
    diasSemana: r.dias_semana,
    periodoMesInicio: r.periodo_mes_inicio, periodoDiaInicio: r.periodo_dia_inicio,
    periodoMesFim: r.periodo_mes_fim, periodoDiaFim: r.periodo_dia_fim,
    dataInicio: r.data_inicio, dataFim: r.data_fim,
  };
}

/** Regra ainda não salva, no formato do passo "Preços especiais" (valor como texto). */
export type RegraFormulario = {
  tipo: TipoRegraRecorrente; nome: string; valor: string; diasSemana: number[];
  periodoMesInicio: number; periodoDiaInicio: number; periodoMesFim: number; periodoDiaFim: number;
};

export function regraDeFormulario(r: RegraFormulario, id: string): RegraPreco {
  return {
    id, tipo: r.tipo, nome: r.nome, valor: parseFloat(r.valor), prioridade: 0,
    diasSemana: r.diasSemana,
    periodoMesInicio: r.periodoMesInicio, periodoDiaInicio: r.periodoDiaInicio,
    periodoMesFim: r.periodoMesFim, periodoDiaFim: r.periodoDiaFim,
  };
}

/**
 * Regra "pronta para o calendário" a partir do que o gestor está digitando no
 * formulário de nova regra; `null` enquanto o preço ou os campos do tipo
 * estiverem incompletos (a prévia só aparece quando já dá para calcular).
 */
export function previaDeFormulario(r: RegraFormulario): RegraPreco | null {
  if (!(parseFloat(r.valor) > 0)) return null;
  if (r.tipo === 'dia_semana' && r.diasSemana.length === 0) return null;
  return regraDeFormulario(r, 'previa');
}

export type OrigemPreco = PrecoRegraTipo | 'preco_base' | 'sem_preco';

export type PrecoDoDia = {
  valor: number | null;
  origem: OrigemPreco;
  regra: RegraPreco | null;
  /**
   * Quantas regras de período anual / dia da semana valem na data — a
   * vencedora inclusa, quando é uma delas. Com 2+ venceu a de maior preço;
   * com data específica, são as regras que ela sobrepõe.
   */
  concorrentes: number;
};

// ── Datas ───────────────────────────────────────────────────────────────────

function utc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function somarDiasISO(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado (mesmo `EXTRACT(DOW)` do Postgres). */
export function diaDaSemanaISO(iso: string): number {
  return utc(iso).getUTCDay();
}

export function intervaloISO(a: string, b: string): string[] {
  const [ini, fim] = a <= b ? [a, b] : [b, a];
  const dias: string[] = [];
  for (let d = ini; d <= fim; d = somarDiasISO(d, 1)) dias.push(d);
  return dias;
}

// ── Resolução ───────────────────────────────────────────────────────────────

/** A regra cobre esta data? (ignora precedência entre regras). */
export function regraCobreData(r: RegraPreco, iso: string): boolean {
  if (r.ativo === false) return false;
  const mmdd = Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));

  if (r.tipo === 'data_fixa') {
    return !!r.dataInicio && !!r.dataFim && iso >= r.dataInicio && iso <= r.dataFim;
  }
  if (r.tipo === 'periodo_anual') {
    if (r.periodoMesInicio == null || r.periodoDiaInicio == null
      || r.periodoMesFim == null || r.periodoDiaFim == null) return false;
    const ini = r.periodoMesInicio * 100 + r.periodoDiaInicio;
    const fim = r.periodoMesFim * 100 + r.periodoDiaFim;
    // Período que cruza o ano (ex.: 01/12 → 28/02).
    return ini <= fim ? mmdd >= ini && mmdd <= fim : mmdd >= ini || mmdd <= fim;
  }
  return !!r.diasSemana?.includes(diaDaSemanaISO(iso));
}

// Empate de valor entre regras recorrentes: a mais específica dá nome à origem.
const ORDEM_EMPATE: Record<PrecoRegraTipo, number> = { data_fixa: 0, periodo_anual: 1, dia_semana: 2 };

/**
 * Preço de uma data:
 *  1. data específica (definida no calendário) vence sempre, mesmo mais barata
 *     — entre sobrepostas, maior `prioridade` e depois maior valor;
 *  2. senão, entre as regras de período anual e dia da semana que valem na
 *     data, vence a de MAIOR preço (empate: período anual, depois maior
 *     `prioridade`, depois a primeira da lista);
 *  3. senão, o preço base.
 */
export function resolverPrecoNaData(
  precoBase: number | null,
  regras: RegraPreco[],
  iso: string,
): PrecoDoDia {
  let dataEspecifica: RegraPreco | null = null;
  let maior: RegraPreco | null = null;
  let concorrentes = 0;

  for (const r of regras) {
    if (!regraCobreData(r, iso)) continue;
    if (r.tipo === 'data_fixa') {
      if (!dataEspecifica || r.prioridade > dataEspecifica.prioridade
        || (r.prioridade === dataEspecifica.prioridade && r.valor > dataEspecifica.valor)) dataEspecifica = r;
      continue;
    }
    concorrentes++;
    if (!maior || r.valor > maior.valor || (r.valor === maior.valor && (
      ORDEM_EMPATE[r.tipo] < ORDEM_EMPATE[maior.tipo]
      || (r.tipo === maior.tipo && r.prioridade > maior.prioridade)
    ))) maior = r;
  }

  const vencedora = dataEspecifica ?? maior;
  if (vencedora) return { valor: vencedora.valor, origem: vencedora.tipo, regra: vencedora, concorrentes };
  if (precoBase != null) return { valor: precoBase, origem: 'preco_base', regra: null, concorrentes };
  return { valor: null, origem: 'sem_preco', regra: null, concorrentes };
}

// ── Datas específicas (preço de um dia, definido no calendário) ────────────

export type AjusteManualIntervalo = { inicio: string; fim: string; valor: number };

/** Dias consecutivos com o mesmo valor viram um intervalo (= uma regra no banco). */
export function compactarAjustes(ajustes: Record<string, number>): AjusteManualIntervalo[] {
  const grupos: AjusteManualIntervalo[] = [];
  for (const dia of Object.keys(ajustes).sort()) {
    const valor = ajustes[dia];
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.valor === valor && somarDiasISO(ultimo.fim, 1) === dia) ultimo.fim = dia;
    else grupos.push({ inicio: dia, fim: dia, valor });
  }
  return grupos;
}

/** Toda regra `data_fixa` é uma data específica: só o calendário cria esse tipo. */
export function ehDataEspecificaBanco(r: { tipo: string }): boolean {
  return r.tipo === 'data_fixa';
}

/**
 * Datas específicas salvas no banco → um preço por dia. Sobrepostas resolvem
 * como no SQL (maior `prioridade`, depois maior valor): a vencedora é gravada por último.
 */
export function ajustesDeBanco(regras: RegraBanco[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  const datas = regras
    .filter(r => r.ativo && ehDataEspecificaBanco(r) && r.data_inicio && r.data_fim)
    .sort((a, b) => a.prioridade - b.prioridade || Number(a.valor) - Number(b.valor));
  for (const r of datas) {
    for (const d of intervaloISO(r.data_inicio!, r.data_fim!)) mapa[d] = Number(r.valor);
  }
  return mapa;
}

/** Datas específicas viram regras de 1 dia para o resolvedor. */
export function ajustesComoRegras(ajustes: Record<string, number>): RegraPreco[] {
  return Object.entries(ajustes).map(([dia, valor]) => ({
    id: `ajuste:${dia}`,
    tipo: 'data_fixa' as const,
    nome: NOME_DATA_ESPECIFICA,
    valor,
    prioridade: PRIORIDADE_DATA_ESPECIFICA,
    dataInicio: dia,
    dataFim: dia,
  }));
}

// ── Taxa da plataforma ──────────────────────────────────────────────────────

export type DecomposicaoPreco = {
  /** Preço do passeio definido pelo gestor — o que ele recebe. */
  voceRecebe: number;
  taxaPercent: number;
  /** Comissão do Boatzy, somada ao preço e paga pelo cliente. */
  taxaValor: number;
  clientePaga: number;
};

/**
 * Mesma conta do checkout (`calcularValoresPedido`): a comissão é somada ao
 * preço e paga pelo cliente; o gestor recebe o preço integral.
 */
export function decomporPreco(preco: number, taxaPercent: number): DecomposicaoPreco {
  const v = calcularValoresPedido({
    precoUnitario: preco, multiplicador: 1, totalAdicionais: 0, taxaPercent, descontoCupom: 0,
  });
  return { voceRecebe: v.valorItens, taxaPercent, taxaValor: v.valorComissao, clientePaga: v.valorTotal };
}
