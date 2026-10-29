/**
 * Quando saem os lembretes do passeio (SPEC §96) — função pura, usada pelo job
 * `/api/cron/lembretes-passeio` e pela linha do tempo (lembretes previstos).
 *
 * - D-1: às 10h (Brasília) do dia anterior ao passeio; vale até a hora do H-3.
 * - H-3: 3h antes de `roteiro.horario_saida`; vale até a partida. Roteiro sem
 *   horário de saída: às 7h do dia do passeio ("seu passeio é hoje"), até o meio-dia.
 *
 * Brasília não tem horário de verão desde 2019: o offset é sempre -03:00.
 */

export type MarcoLembrete = 'd1' | 'h3';

export const MARCOS_LEMBRETE: MarcoLembrete[] = ['d1', 'h3'];

const OFFSET_BRASILIA = '-03:00';
export const HORA_LEMBRETE_D1 = '10:00';
/** Sem horário de saída cadastrado, o lembrete do dia sai neste horário. */
export const HORA_LEMBRETE_SEM_HORARIO = '07:00';
const HORA_LIMITE_SEM_HORARIO = '12:00';
const HORAS_ANTES_H3 = 3;

function instante(dataISO: string, hhmm: string): Date {
  return new Date(`${dataISO}T${hhmm}:00${OFFSET_BRASILIA}`);
}

export function somarDiasISO(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1, d + dias));
  return alvo.toISOString().slice(0, 10);
}

/** 'HH:MM' de um `time` do banco ('HH:MM:SS'), ou null se inválido. */
function hhmm(horario: string | null | undefined): string | null {
  const m = /^(\d{2}):(\d{2})/.exec(horario ?? '');
  return m ? `${m[1]}:${m[2]}` : null;
}

export type AgendaLembretes = {
  /** Instante da partida (null quando o roteiro não tem horário de saída). */
  partida: Date | null;
  /** Janela de cada marco: envia em [inicio, fim). */
  janelas: Record<MarcoLembrete, { inicio: Date; fim: Date }>;
};

export function agendaLembretes(dataReserva: string, horarioSaida: string | null | undefined): AgendaLembretes {
  const saida = hhmm(horarioSaida);
  const partida = saida ? instante(dataReserva, saida) : null;
  const inicioH3 = partida
    ? new Date(partida.getTime() - HORAS_ANTES_H3 * 3_600_000)
    : instante(dataReserva, HORA_LEMBRETE_SEM_HORARIO);
  const fimH3 = partida ?? instante(dataReserva, HORA_LIMITE_SEM_HORARIO);
  return {
    partida,
    janelas: {
      d1: { inicio: instante(somarDiasISO(dataReserva, -1), HORA_LEMBRETE_D1), fim: inicioH3 },
      h3: { inicio: inicioH3, fim: fimH3 },
    },
  };
}
