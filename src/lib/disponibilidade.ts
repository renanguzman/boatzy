import { decomporPreco, somarDiasISO, diaDaSemanaISO } from '@/lib/precos-calendario';
import { formatarData } from '@/lib/datas';

/**
 * Disponibilidade de cada dia de um roteiro — ESPELHO da função SQL
 * `roteiro_situacao_dia` (migration 20261017), a fonte da verdade do site, do
 * checkout e da busca. Existe em TypeScript para o painel pré-visualizar o que
 * o gestor ainda não salvou e para o site validar um intervalo Por Diária na
 * hora. Se a regra mudar no SQL, mude aqui também. Puro e client-safe; datas
 * como 'yyyy-mm-dd' com aritmética em UTC.
 */

/** Ordem de decisão — a primeira que se aplica (igual ao SQL). */
export type SituacaoDia =
  | 'passado'        // antes de hoje (Brasília)
  | 'ocupado'        // reserva confirmada/aguardando pagamento do roteiro ou do barco
  | 'barco_fechado'  // o gestor fechou o barco inteiro (todos os roteiros dele)
  | 'fechado'        // o gestor fechou o dia neste roteiro
  | 'nao_opera'      // dia da semana fora da operação (e o gestor não abriu o dia)
  | 'fora_janela'    // depois de hoje + janela de reservas
  | 'disponivel';

/** Janelas de reserva que o gestor pode escolher (meses à frente). */
export const JANELAS_RESERVA_MESES = [3, 6, 9, 12] as const;
export type JanelaReservaMeses = (typeof JANELAS_RESERVA_MESES)[number];
export const JANELA_RESERVA_PADRAO: JanelaReservaMeses = 3;

export function janelaValida(n: number | null | undefined): JanelaReservaMeses {
  return (JANELAS_RESERVA_MESES as readonly number[]).includes(n ?? 0) ? (n as JanelaReservaMeses) : JANELA_RESERVA_PADRAO;
}

export type AgendaRoteiro = {
  /** Hoje ('yyyy-mm-dd', Brasília). */
  hoje: string;
  /** Última data que o cliente pode reservar (`dataMaximaReservaISO(janela)`). */
  dataMaxima: string;
  /** Dias da semana de operação (0=Dom..6=Sáb). Vazio = todos. */
  diasOperacao: number[];
  /** Exceções do roteiro: false = dia fechado; true = dia aberto fora da operação. */
  diasRoteiro: Record<string, boolean>;
  /** Datas em que o barco inteiro foi fechado. */
  barcoFechado: ReadonlySet<string>;
  /** Datas ocupadas por reserva do roteiro ou de qualquer roteiro do barco. */
  ocupadas: ReadonlySet<string>;
};

export function situacaoDoDia(a: AgendaRoteiro, iso: string): SituacaoDia {
  if (iso < a.hoje) return 'passado';
  if (a.ocupadas.has(iso)) return 'ocupado';
  if (a.barcoFechado.has(iso)) return 'barco_fechado';
  const excecao = a.diasRoteiro[iso];
  if (excecao === false) return 'fechado';
  if (excecao !== true && a.diasOperacao.length > 0 && !a.diasOperacao.includes(diaDaSemanaISO(iso))) {
    return 'nao_opera';
  }
  if (iso > a.dataMaxima) return 'fora_janela';
  return 'disponivel';
}

/**
 * Espelho de `roteiro_periodo_indisponivel`: null quando o período pode ser
 * reservado; senão a situação do primeiro dia que impede. A saída precisa
 * estar disponível; nos dias seguintes (Por Diária) só não pode estar
 * ocupado/fechado — dia fora da operação ou da janela não interrompe a viagem.
 */
export function periodoIndisponivel(
  situacao: (iso: string) => SituacaoDia | StatusPublico,
  inicio: string,
  fim: string,
): SituacaoDia | StatusPublico | null {
  if (fim < inicio) return 'indisponivel';
  const primeira = situacao(inicio);
  if (primeira !== 'disponivel') return primeira;
  for (let d = somarDiasISO(inicio, 1); d <= fim; d = somarDiasISO(d, 1)) {
    const s = situacao(d);
    if (s !== 'disponivel' && s !== 'nao_opera' && s !== 'fora_janela') return s;
  }
  return null;
}

/** Reserva que ocupa um dia do calendário do roteiro (painel). */
export type OcupacaoDia = {
  data: string;
  status: 'confirmada' | 'aguardando_pagamento';
  reservaId: string;
  /** Roteiro da reserva — pode ser outro roteiro do mesmo barco. */
  roteiroId: string | null;
  roteiroNome: string | null;
  /** false = o barco está ocupado por OUTRO roteiro. */
  mesmoRoteiro: boolean;
};

/** Datas em grupos de dias seguidos (para os chips do painel). */
export function agruparDatas(datas: string[]): { inicio: string; fim: string; dias: number }[] {
  const grupos: { inicio: string; fim: string; dias: number }[] = [];
  for (const d of [...new Set(datas)].sort()) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && somarDiasISO(ultimo.fim, 1) === d) { ultimo.fim = d; ultimo.dias++; }
    else grupos.push({ inicio: d, fim: d, dias: 1 });
  }
  return grupos;
}

// ── Site (cliente) ──────────────────────────────────────────────────────────

/**
 * O que o cliente vê de cada dia — sem revelar se um dia indisponível está
 * reservado ou fechado. `nao_opera` e `fora_janela` continuam distintos porque
 * não impedem os dias seguintes de uma reserva Por Diária.
 */
export type StatusPublico = 'disponivel' | 'nao_opera' | 'fora_janela' | 'indisponivel';

export function statusPublico(s: SituacaoDia): StatusPublico {
  if (s === 'disponivel' || s === 'nao_opera' || s === 'fora_janela') return s;
  return 'indisponivel';
}

export type DiaReserva = {
  data: string;
  status: StatusPublico;
  /** Preço do passeio (modelo Roteiro) definido pelo gestor. null = sem preço. */
  preco: number | null;
  /** Total que o cliente paga nesse dia: preço + taxa de serviço. */
  total: number | null;
};

/** Calendário que a página do roteiro recebe (o mesmo que o gestor configura). */
export type CalendarioCliente = {
  /** De hoje até um pouco depois da data máxima (dias seguintes de uma reserva Por Diária). */
  dias: DiaReserva[];
  /** Última data em que uma reserva pode começar (janela do roteiro). */
  dataMaxima: string;
  /** Taxa de serviço (%) do gestor dono — o total já a inclui. */
  taxaPercent: number;
};

/** Converte o calendário (situação + preço do gestor) no que o cliente vê. */
export function diasParaCliente(
  dias: { data: string; situacao: SituacaoDia; preco: number | null }[],
  taxaPercent: number,
): DiaReserva[] {
  return dias.map(d => {
    const preco = d.preco != null && d.preco > 0 ? d.preco : null;
    return {
      data: d.data,
      status: statusPublico(d.situacao),
      preco,
      total: preco != null ? decomporPreco(preco, taxaPercent).clientePaga : null,
    };
  });
}

/**
 * Mesmo calendário, calculado no navegador (pré-visualização do painel, com o
 * que ainda não foi salvo) — situação pelo espelho `situacaoDoDia`.
 */
export function calendarioClienteLocal(params: {
  agenda: AgendaRoteiro;
  precoDoDia: (iso: string) => number | null;
  taxaPercent: number;
  /** Último dia a incluir. */
  ate: string;
}): CalendarioCliente {
  const linhas: { data: string; situacao: SituacaoDia; preco: number | null }[] = [];
  for (let d = params.agenda.hoje; d <= params.ate; d = somarDiasISO(d, 1)) {
    linhas.push({ data: d, situacao: situacaoDoDia(params.agenda, d), preco: params.precoDoDia(d) });
  }
  return {
    dias: diasParaCliente(linhas, params.taxaPercent),
    dataMaxima: params.agenda.dataMaxima,
    taxaPercent: params.taxaPercent,
  };
}

/** Dias além da data máxima que o site carrega (continuação de reservas Por Diária). */
export const DIAS_APOS_JANELA = 31;

/** Mensagem do checkout para a situação que impede a reserva. */
export function mensagemIndisponivel(s: SituacaoDia | StatusPublico | 'inexistente' | 'invalido', dataMaxima: string): string {
  switch (s) {
    case 'fora_janela':
      return `As reservas deste passeio estão abertas até ${formatarData(dataMaxima)}. Escolha uma data até lá.`;
    case 'nao_opera':
      return 'O passeio não opera nesse dia. Escolha outra data no calendário.';
    case 'passado':
      return 'Essa data já passou. Escolha outra data.';
    case 'inexistente':
      return 'Roteiro não encontrado ou indisponível.';
    case 'invalido':
      return 'Período inválido.';
    default:
      return 'Essa data não está mais disponível. Escolha outra data.';
  }
}
