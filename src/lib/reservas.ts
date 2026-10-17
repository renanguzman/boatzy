import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { OcupacaoDia, SituacaoDia } from '@/lib/disponibilidade';

export type { OcupacaoDia };

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

// ─── Calendário do roteiro (preço + disponibilidade) ──────────────────────────

/**
 * Dias de hoje em diante ocupados para o roteiro, com a origem de cada um —
 * reserva do próprio roteiro ou de outro roteiro do barco vinculado (um barco
 * faz um passeio por dia). `roteiroId` null = roteiro ainda não criado.
 */
export async function getOcupacaoRoteiro(params: {
  roteiroId: string | null;
  embarcacaoId: string | null;
}): Promise<OcupacaoDia[]> {
  const condicoes: string[] = [];
  if (params.roteiroId) condicoes.push(`roteiro_id.eq.${params.roteiroId}`);
  if (params.embarcacaoId) condicoes.push(`embarcacao_id.eq.${params.embarcacaoId}`);
  if (condicoes.length === 0) return [];

  const hoje = hojeBrasil();
  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('id, status, roteiro_id, data_reserva, data_fim_reserva, roteiro ( nome )')
    .in('status', [...STATUS_QUE_OCUPAM_DATA])
    .or(condicoes.join(','))
    // Corte grosso (diárias longas começam antes de hoje); o fino é abaixo.
    .gte('data_reserva', somarDiasISO(hoje, -60));

  if (error) {
    console.error('[reservas] falha ao buscar ocupação do roteiro:', error);
    return [];
  }

  const ocupacao: OcupacaoDia[] = [];
  for (const r of data ?? []) {
    const nome = (r.roteiro as unknown as { nome: string } | null)?.nome ?? null;
    for (const d of expandirIntervalo(r.data_reserva, r.data_fim_reserva ?? r.data_reserva)) {
      if (d < hoje) continue;
      ocupacao.push({
        data: d,
        status: r.status as OcupacaoDia['status'],
        reservaId: r.id,
        roteiroId: r.roteiro_id,
        roteiroNome: nome,
        mesmoRoteiro: params.roteiroId != null && r.roteiro_id === params.roteiroId,
      });
    }
  }
  return ocupacao;
}

/** Pedidos pendentes do roteiro por dia (não seguram a data — só aviso no painel). */
export async function getPedidosPendentesRoteiro(roteiroId: string): Promise<Record<string, number>> {
  const hoje = hojeBrasil();
  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('data_reserva, data_fim_reserva')
    .eq('roteiro_id', roteiroId)
    .eq('status', 'pendente')
    .or(`data_fim_reserva.gte.${hoje},data_reserva.gte.${hoje}`);

  if (error) {
    console.error('[reservas] falha ao buscar pedidos pendentes do roteiro:', error);
    return {};
  }
  const porDia: Record<string, number> = {};
  for (const r of data ?? []) {
    for (const d of expandirIntervalo(r.data_reserva, r.data_fim_reserva ?? r.data_reserva)) {
      if (d >= hoje) porDia[d] = (porDia[d] ?? 0) + 1;
    }
  }
  return porDia;
}

/** Datas (de hoje em diante) em que o gestor fechou o barco inteiro. */
export async function getFechamentosEmbarcacao(embarcacaoId: string | null): Promise<string[]> {
  if (!embarcacaoId) return [];
  const { data, error } = await supabaseAdmin
    .from('embarcacao_disponibilidade_bloqueio')
    .select('data')
    .eq('embarcacao_id', embarcacaoId)
    .gte('data', hojeBrasil());

  if (error) {
    console.error('[reservas] falha ao buscar fechamentos da embarcação:', error);
    return [];
  }
  return (data ?? []).map((r) => r.data).sort();
}

/** Exceções de disponibilidade do roteiro: data → false (fechado) / true (aberto fora da operação). */
export async function getDisponibilidadeDiasRoteiro(roteiroId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabaseAdmin
    .from('roteiro_disponibilidade_dia')
    .select('data, disponivel')
    .eq('roteiro_id', roteiroId);

  if (error) {
    console.error('[reservas] falha ao buscar disponibilidade do roteiro:', error);
    return {};
  }
  return Object.fromEntries((data ?? []).map((r) => [r.data, r.disponivel]));
}

/**
 * Calendário do roteiro (situação + preço do gestor por dia) pela função SQL
 * `roteiro_calendario` — a fonte da verdade do site. Erro → lista vazia.
 */
export async function getCalendarioRoteiro(
  roteiroId: string,
  de: string,
  ate: string,
): Promise<{ data: string; situacao: SituacaoDia; preco: number | null }[]> {
  const { data, error } = await supabaseAdmin.rpc('roteiro_calendario', {
    p_roteiro_id: roteiroId,
    p_de: de,
    p_ate: ate,
  });
  if (error) {
    console.error('[reservas] falha ao montar o calendário do roteiro:', error.message);
    return [];
  }
  return (data ?? []).map((d) => ({
    data: d.data,
    situacao: d.situacao as SituacaoDia,
    preco: d.preco != null ? Number(d.preco) : null,
  }));
}

/**
 * Checkout: null quando o período pode ser reservado; senão a situação do
 * primeiro dia que impede (`roteiro_periodo_indisponivel`).
 */
export async function getMotivoPeriodoIndisponivel(
  roteiroId: string,
  inicio: string,
  fim: string,
): Promise<SituacaoDia | 'inexistente' | 'invalido' | null> {
  const { data, error } = await supabaseAdmin.rpc('roteiro_periodo_indisponivel', {
    p_roteiro_id: roteiroId,
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) {
    console.error('[reservas] falha ao validar o período:', error.message);
    // Sem a validação não dá para garantir a data: recusa por segurança.
    return 'ocupado';
  }
  return (data as SituacaoDia | 'inexistente' | 'invalido' | null) ?? null;
}
