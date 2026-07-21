import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

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
 * Datas ('yyyy-mm-dd') com reserva CONFIRMADA que bloqueiam o calendário de
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
    .eq('status', 'confirmada');

  if (error) {
    console.error('[reservas] falha ao buscar datas reservadas da embarcação:', error);
    return [];
  }
  return (data ?? []).map((r) => r.data_reserva);
}

/**
 * Datas ('yyyy-mm-dd') com reserva CONFIRMADA que bloqueiam o calendário de
 * um ROTEIRO: as do próprio roteiro (roteiro_id — protege o roteiro mesmo
 * sem embarcação vinculada, ou se ela mudou depois da confirmação, já que
 * reserva.embarcacao_id é um snapshot) + as da embarcação vinculada
 * ATUALMENTE (embarcacaoId deve vir do roteiro.embarcacao_id vigente).
 */
export async function getDatasReservadasRoteiro(params: {
  roteiroId: string;
  embarcacaoId: string | null;
}): Promise<string[]> {
  const { roteiroId, embarcacaoId } = params;
  const condicoes = [`roteiro_id.eq.${roteiroId}`];
  if (embarcacaoId) condicoes.push(`embarcacao_id.eq.${embarcacaoId}`);

  const { data, error } = await supabaseAdmin
    .from('reserva')
    .select('data_reserva')
    .eq('status', 'confirmada')
    .or(condicoes.join(','));

  if (error) {
    console.error('[reservas] falha ao buscar datas reservadas do roteiro:', error);
    return [];
  }
  return (data ?? []).map((r) => r.data_reserva);
}
