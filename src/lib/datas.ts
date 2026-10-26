/**
 * Datas no fuso da plataforma (horário de Brasília).
 *
 * O servidor (Vercel) roda em UTC: formatar um instante sem `timeZone` mostra
 * a hora 3h adiantada, e `new Date().toISOString().slice(0, 10)` devolve o dia
 * seguinte entre 21h e meia-noite. Toda data exibida ou "hoje" calculado deve
 * passar por aqui (ou usar `timeZone: FUSO_HORARIO`). Funciona igual no
 * servidor e no navegador.
 *
 * O fuso é sempre o de Brasília, em qualquer idioma; o `idioma` (padrão
 * pt-BR, o do painel e do admin) muda só o formato — SPEC §94.5.
 */

import { IDIOMA_PADRAO, LOCALE_INTL, type Idioma } from '@/i18n/config';

export const FUSO_HORARIO = 'America/Sao_Paulo';

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte o valor em `Date`. Campos só de data ('AAAA-MM-DD', ex.:
 * `data_reserva`) viram meio-dia UTC — assim nunca caem no dia anterior ao
 * serem exibidos em Brasília. Timestamps ISO são usados como estão.
 */
export function paraData(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  return SO_DATA.test(valor) ? new Date(`${valor}T12:00:00Z`) : new Date(valor);
}

function valido(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/** Hora no costume de cada idioma: 24h em pt-BR e es (20:39), 12h em en-US (8:39 PM). */
export function opcoesHora(idioma: Idioma): Intl.DateTimeFormatOptions {
  return idioma === 'en-US'
    ? { hour: 'numeric', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
}

/** 'AAAA-MM-DD' de um instante no horário de Brasília. */
export function dataISONoFuso(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO }).format(d);
}

/** Data de hoje ('AAAA-MM-DD') no horário de Brasília. */
export function hojeISO(): string {
  return dataISONoFuso(new Date());
}

/**
 * Antecedência máxima padrão para o cliente reservar um roteiro, em meses. Cada
 * roteiro tem a sua (`roteiro.janela_reserva_meses`: 3, 6, 9 ou 12 — ver
 * `src/lib/disponibilidade.ts`).
 */
export const MESES_ANTECEDENCIA_RESERVA = 3;

/**
 * Última data ('AAAA-MM-DD') que o cliente pode reservar: hoje (Brasília) + N
 * meses, com o dia ajustado ao fim do mês quando não existe (30/11 + 3 → 28/02)
 * — mesma conta do SQL (`CURRENT_DATE + make_interval(months => N)`).
 */
export function dataMaximaReservaISO(meses: number = MESES_ANTECEDENCIA_RESERVA, hoje: string = hojeISO()): string {
  const [ano, mes, dia] = hoje.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/** Ano, mês (0–11) e dia de um instante no horário de Brasília. */
export function partesNoFuso(d: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = dataISONoFuso(d).split('-').map(Number);
  return { ano, mes: mes - 1, dia };
}

/** Data formatada (padrão 30/09/2026; en-US 09/30/2026). Aceita timestamp ISO ou 'AAAA-MM-DD'. */
export function formatarData(
  valor: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
  idioma: Idioma = IDIOMA_PADRAO,
): string {
  if (!valor) return '—';
  const d = paraData(valor);
  if (!valido(d)) return '—';
  return d.toLocaleDateString(LOCALE_INTL[idioma], { ...opts, timeZone: FUSO_HORARIO });
}

/** Data e hora (padrão 30/09/2026, 20:39). */
export function formatarDataHora(
  valor: string | Date | null | undefined,
  opts: { segundos?: boolean } = {},
  idioma: Idioma = IDIOMA_PADRAO,
): string {
  if (!valor) return '—';
  const d = paraData(valor);
  if (!valido(d)) return '—';
  return d.toLocaleString(LOCALE_INTL[idioma], {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...opcoesHora(idioma), ...(opts.segundos ? { second: '2-digit' } : {}),
    timeZone: FUSO_HORARIO,
  });
}

/** Só a hora (20:39; en-US 8:39 PM). */
export function formatarHora(valor: string | Date | null | undefined, idioma: Idioma = IDIOMA_PADRAO): string {
  if (!valor) return '—';
  const d = paraData(valor);
  if (!valido(d)) return '—';
  return d.toLocaleTimeString(LOCALE_INTL[idioma], { ...opcoesHora(idioma), timeZone: FUSO_HORARIO });
}
