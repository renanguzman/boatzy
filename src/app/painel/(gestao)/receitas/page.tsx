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

  const CAMPOS_RESERVA = `id, tipo, data_reserva, item_nome, quantidade_pessoas,
       preco_base, total_adicionais, taxa_servico, total_estimado,
       status, solicitado_em,
       cliente:users!reserva_cliente_id_fkey ( id, name ),
       roteiro ( id, nome ),
       embarcacao ( id, nome )`;

  const [{ data }, { data: avulsas }] = await Promise.all([
    supabaseAdmin
      .from('reserva')
      .select(CAMPOS_RESERVA)
      .eq('owner_id', user.id)
      .order('data_reserva', { ascending: false }),
    // Cobranças avulsas pagas (SPEC §34.16): entram como linhas próprias, na data do passeio de origem.
    supabaseAdmin
      .from('pedido')
      .select(`id, numero, valor_itens, valor_comissao, valor_total, pedido_avulso ( titulo, reserva:reserva_id ( ${CAMPOS_RESERVA} ) )`)
      .eq('gestor_id', user.id)
      .eq('tipo', 'avulso')
      .in('status', ['pago', 'reembolsado_parcial', 'em_disputa']),
  ]);

  type AvulsaBruta = {
    id: string; numero: number; valor_itens: number; valor_comissao: number; valor_total: number;
    pedido_avulso: { titulo: string; reserva: ReservaReceita | null } | { titulo: string; reserva: ReservaReceita | null }[] | null;
  };
  const linhasAvulsas: ReservaReceita[] = ((avulsas ?? []) as unknown as AvulsaBruta[]).flatMap((a) => {
    const pa = Array.isArray(a.pedido_avulso) ? a.pedido_avulso[0] : a.pedido_avulso;
    if (!pa?.reserva) return [];
    return [{
      ...pa.reserva,
      id: a.id,
      preco_base: Number(a.valor_itens),
      total_adicionais: 0,
      taxa_servico: Number(a.valor_comissao),
      total_estimado: Number(a.valor_total),
      avulsa: { titulo: pa.titulo, numero: a.numero },
    }];
  });

  const reservas = [...((data ?? []) as unknown as ReservaReceita[]), ...linhasAvulsas]
    .sort((x, y) => y.data_reserva.localeCompare(x.data_reserva));
  return <ReceitasView reservas={reservas} />;
}
