import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { concluirReservasVencidas } from '@/lib/reservas';
import ReceitasView from './_components/ReceitasView';
import type { ReservaReceita } from './_lib/types';

export default async function ReceitasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Transição lazy confirmada → concluída, mesmo padrão do dashboard/agendamentos.
  await concluirReservasVencidas();

  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, data_reserva, item_nome, quantidade_pessoas,
       preco_base, total_adicionais, taxa_servico, total_estimado,
       status, solicitado_em,
       cliente:users!reserva_cliente_id_fkey ( id, name ),
       roteiro ( id, nome ),
       embarcacao ( id, nome )`,
    )
    .eq('owner_id', user.id)
    .order('data_reserva', { ascending: false });

  return <ReceitasView reservas={(data ?? []) as unknown as ReservaReceita[]} />;
}
