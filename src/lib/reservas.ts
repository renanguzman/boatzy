import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

/**
 * Status que SEGURAM a data da embarcação/roteiro: a reserva confirmada e a
 * aceita que aguarda o pagamento do cliente (senão duas solicitações da mesma
 * data poderiam ser aceitas ao mesmo tempo). Espelha os índices únicos
 * parciais reserva_*_data_ocupada_uniq (migration 20260930d).
 */
export const STATUS_QUE_OCUPAM_DATA = ['confirmada', 'aguardando_pagamento'] as const;

/** Data de hoje (yyyy-mm-dd) no fuso do Brasil — evita concluir reservas "de hoje" à noite por causa do UTC. */
function hojeBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Transição automática (lazy) confirmada → concluída: reservas confirmadas cuja
 * data já passou viram 'concluida', habilitando a avaliação pelo cliente.
 * Chamada ao carregar /minhas-reservas e /painel/agendamentos — não há cron.
 */
export async function concluirReservasVencidas(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('reserva')
    .update({ status: 'concluida' })
    .eq('status', 'confirmada')
    .lt('data_reserva', hojeBrasil());

  if (error) {
    console.error('[reservas] falha ao concluir reservas vencidas:', error);
  }
}

/**
 * Datas ('yyyy-mm-dd') com reserva CONFIRMADA (ou aceita aguardando pagamento) que bloqueiam o calendário de
 * uma EMBARCAÇÃO — reserva direta dela OU via qualquer roteiro que a
 * utilize (reserva.embarcacao_id é preenchido nos dois casos, migration
 * 022). A embarcação é o recurso físico compartilhado entre vários
 * roteiros, por isso o bloqueio precisa valer para todos eles.
 */
export async function getDatasReservadasEmbarcacao(embarcacaoId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('data_reserva')
    .eq('embarcacao_id', embarcacaoId)
    .in('status', [...STATUS_QUE_OCUPAM_DATA]);

  if (error) {
    console.error('[reservas] falha ao buscar datas reservadas da embarcação:', error);
    return [];
  }
  return (data ?? []).map((r) => r.data_reserva);
}

/** Soma `dias` dias a uma data ISO ('yyyy-mm-dd'), devolvendo outra data ISO. */
export function somarDiasISO(inicio: string, dias: number): string {
  const d = new Date(`${inicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Expande um intervalo de datas ('yyyy-mm-dd', inclusive nas duas pontas) dia a dia. */
export function expandirIntervalo(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  let atual = new Date(`${inicio}T12:00:00Z`);
  const limite = new Date(`${fim}T12:00:00Z`);
  while (atual.getTime() <= limite.getTime()) {
    datas.push(atual.toISOString().slice(0, 10));
    atual = new Date(atual.getTime() + 24 * 60 * 60 * 1000);
  }
  return datas;
}

/**
 * Datas ('yyyy-mm-dd') ocupadas para o ROTEIRO: combina as reservas
 * confirmadas do próprio roteiro (roteiro_id — protege o roteiro mesmo sem
 * embarcação vinculada, ou se ela mudou depois da confirmação, já que
 * reserva.embarcacao_id é um snapshot) com as da embarcação vinculada
 * ATUALMENTE (embarcacaoId deve vir do roteiro.embarcacao_id vigente). Toda
 * reserva trava o dia inteiro (ou o intervalo, no Por Diária): a embarcação é
 * um recurso físico único, compartilhado entre os roteiros dela.
 */
export async function getDatasOcupadasRoteiro(params: {
  roteiroId: string;
  embarcacaoId: string | null;
}): Promise<string[]> {
  const condicoes = [`roteiro_id.eq.${params.roteiroId}`];
  if (params.embarcacaoId) condicoes.push(`embarcacao_id.eq.${params.embarcacaoId}`);

  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('data_reserva, data_fim_reserva')
    .in('status', [...STATUS_QUE_OCUPAM_DATA])
    .or(condicoes.join(','));

  if (error) {
    console.error('[reservas] falha ao buscar disponibilidade do roteiro:', error);
    return [];
  }

  const ocupadas = new Set<string>();
  for (const r of data ?? []) {
    for (const d of expandirIntervalo(r.data_reserva, r.data_fim_reserva ?? r.data_reserva)) ocupadas.add(d);
  }
  return [...ocupadas];
}

/**
 * Verdadeiro se a reserva informada (ainda pendente) conflita com alguma
 * reserva CONFIRMADA já existente do roteiro/embarcação — usado ao
 * confirmar uma solicitação no painel (`/painel/agendamentos`). Considera o
 * intervalo inteiro (modelo Por Diária).
 */
export async function haConflitoReservaRoteiro(params: {
  roteiroId: string;
  embarcacaoId: string | null;
  dataReserva: string;
  dataFimReserva: string | null;
}): Promise<boolean> {
  const ocupadas = new Set(await getDatasOcupadasRoteiro({
    roteiroId: params.roteiroId,
    embarcacaoId: params.embarcacaoId,
  }));
  return expandirIntervalo(params.dataReserva, params.dataFimReserva ?? params.dataReserva)
    .some((d) => ocupadas.has(d));
}
