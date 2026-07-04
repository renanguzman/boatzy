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
