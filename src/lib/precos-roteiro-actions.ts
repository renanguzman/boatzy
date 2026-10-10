'use server';

import { supabaseAdmin } from '@/lib/supabase';

/**
 * Preço do modelo "Roteiro" na data escolhida, com as regras do gestor
 * aplicadas (data_fixa > periodo_anual > dia_semana > preco_base).
 *
 * Fonte única da resolução por data: a função SQL `get_preco_roteiro`. O card
 * de reserva chama isto ao escolher a data, para o valor exibido ser o mesmo
 * que `/reservas/novo` vai cobrar.
 */
export async function getPrecoRoteiroNaData(
  roteiroId: string,
  dataISO: string,
): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('get_preco_roteiro', {
    p_roteiro_id: roteiroId,
    p_data: dataISO,
  });

  if (error) {
    console.error('[get_preco_roteiro]', error.message);
    return null;
  }
  return data != null ? Number(data) : null;
}
