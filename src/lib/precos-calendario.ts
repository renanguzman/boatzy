import { calcularValoresPedido } from '@/lib/pagamentos/valores';
import type { PrecoRegraTipo } from '@/types/supabase';

/**
 * Preço de cada dia do modelo "Roteiro", resolvido no navegador para o
 * calendário de preços do painel (`CalendarioPrecos`).
 *
 * `resolverPrecoNaData` é um ESPELHO da função SQL `get_preco_roteiro`
 * (migration 20260907) — a fonte da verdade que o site e o checkout usam. Existe
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

/** Ajuste de preço de um dia feito direto no calendário (regra "data específica" de 1 dia). */
export const NOME_AJUSTE_MANUAL = 'Ajuste manual';
/** Maior que o 0 das regras comuns, para o ajuste de um dia vencer uma data específica que o cubra. */
export const PRIORIDADE_AJUSTE_MANUAL = 100;

export function ehAjusteManual(r: {
  tipo: string; nome: string; prioridade: number;
  dataInicio?: string | null; dataFim?: string | null;
}): boolean {
  return r.tipo === 'data_fixa'
    && r.nome === NOME_AJUSTE_MANUAL
    && r.prioridade >= PRIORIDADE_AJUSTE_MANUAL
    && !!r.dataInicio && r.dataInicio === r.dataFim;
}

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

/** Regra ainda não salva, no formato dos formulários de roteiro (valor e datas como texto). */
export type RegraFormulario = {
  tipo: PrecoRegraTipo; nome: string; valor: string; diasSemana: number[];
  periodoMesInicio: number; periodoDiaInicio: number; periodoMesFim: number; periodoDiaFim: number;
  dataInicio: string; dataFim: string;
};

export function regraDeFormulario(r: RegraFormulario, id: string): RegraPreco {
  return {
    id, tipo: r.tipo, nome: r.nome, valor: parseFloat(r.valor), prioridade: 0,
    diasSemana: r.diasSemana,
    periodoMesInicio: r.periodoMesInicio, periodoDiaInicio: r.periodoDiaInicio,
    periodoMesFim: r.periodoMesFim, periodoDiaFim: r.periodoDiaFim,
    dataInicio: r.dataInicio || null, dataFim: r.dataFim || null,
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
  if (r.tipo === 'data_fixa' && (!r.dataInicio || !r.dataFim || r.dataInicio > r.dataFim)) return null;
  return regraDeFormulario(r, 'previa');
}

export type OrigemPreco = PrecoRegraTipo | 'preco_base' | 'sem_preco';

export type PrecoDoDia = {
  valor: number | null;
  origem: OrigemPreco;
  regra: RegraPreco | null;
  manual: boolean;
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

const PRECEDENCIA: PrecoRegraTipo[] = ['data_fixa', 'periodo_anual', 'dia_semana'];

/**
 * Preço de uma data: data específica > período anual > dia da semana > preço
 * base. Dentro do mesmo tipo vence a maior `prioridade` (empate: a primeira da lista).
 */
export function resolverPrecoNaData(
  precoBase: number | null,
  regras: RegraPreco[],
  iso: string,
): PrecoDoDia {
  for (const tipo of PRECEDENCIA) {
    let vencedora: RegraPreco | null = null;
    for (const r of regras) {
      if (r.tipo !== tipo || !regraCobreData(r, iso)) continue;
      if (!vencedora || r.prioridade > vencedora.prioridade) vencedora = r;
    }
    if (vencedora) {
      return { valor: vencedora.valor, origem: tipo, regra: vencedora, manual: ehAjusteManual(vencedora) };
    }
  }
  if (precoBase != null) return { valor: precoBase, origem: 'preco_base', regra: null, manual: false };
  return { valor: null, origem: 'sem_preco', regra: null, manual: false };
}

// ── Ajustes manuais (um por dia) ────────────────────────────────────────────

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

/** Ajustes manuais salvos no banco (regras de data específica) → um preço por dia. */
export function ajustesDeBanco(regras: RegraBanco[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const r of regras) {
    if (!r.ativo || !r.data_inicio || !r.data_fim || !isManualBanco(r)) continue;
    for (const d of intervaloISO(r.data_inicio, r.data_fim)) mapa[d] = Number(r.valor);
  }
  return mapa;
}

export function isManualBanco(r: RegraBanco): boolean {
  return ehAjusteManual({
    tipo: r.tipo, nome: r.nome, prioridade: r.prioridade, dataInicio: r.data_inicio, dataFim: r.data_fim,
  });
}

/** Ajustes manuais viram regras de 1 dia para o resolvedor. */
export function ajustesComoRegras(ajustes: Record<string, number>): RegraPreco[] {
  return Object.entries(ajustes).map(([dia, valor]) => ({
    id: `ajuste:${dia}`,
    tipo: 'data_fixa' as const,
    nome: NOME_AJUSTE_MANUAL,
    valor,
    prioridade: PRIORIDADE_AJUSTE_MANUAL,
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
