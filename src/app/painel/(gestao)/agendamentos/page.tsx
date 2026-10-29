import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { concluirReservasVencidas } from '@/lib/reservas';
import { expirarPedidosVencidosSemFalhar } from '@/lib/pagamentos/pedidos';
import { resumoAvulsasPorReserva } from '@/lib/pagamentos/avulso';
import type { ReservaEvento } from './_components/AgendamentosCalendar';
import AgendamentosVisoes from './_components/AgendamentosVisoes';
import { COOKIE_VISAO_AGENDAMENTOS, parseVisao } from './_components/visao';

export default async function AgendamentosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Transições lazy antes de listar: pagamento vencido → expirada; confirmada com data passada → concluída.
  await expirarPedidosVencidosSemFalhar();
  await concluirReservasVencidas();

  // Todas as reservas dos roteiros/embarcações deste gestor (owner_id).
  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, data_reserva, data_fim_reserva, quantidade_diarias, status, item_nome,
       quantidade_pessoas, modalidade_preco, total_estimado, pagamento_exigido,
       cliente:users!reserva_cliente_id_fkey ( name ),
       roteiro ( horario_saida ),
       pedido ( status, valor_total )`,
    )
    .eq('owner_id', user.id)
    .order('data_reserva', { ascending: true });

  const reservas = (data ?? []) as unknown as ReservaEvento[];
  // Cobranças avulsas em aberto por reserva — sinalizadas na Lista de reservas.
  const avulsas = await resumoAvulsasPorReserva(reservas.map((r) => r.id));
  const eventos = reservas.map((r) => ({ ...r, avulsas_abertas: avulsas[r.id]?.abertas ?? 0 }));
  // Última visualização escolhida (Calendário ou Lista) — SPEC §20.4.
  const visaoInicial = parseVisao((await cookies()).get(COOKIE_VISAO_AGENDAMENTOS)?.value);
  // Cobranças avulsas aguardando o cliente (SPEC §34.16) — aparecem no detalhe de cada reserva.
  const { count: cobrancasAbertas } = await supabaseAdmin
    .from('pedido')
    .select('id', { count: 'exact', head: true })
    .eq('gestor_id', user.id)
    .eq('tipo', 'avulso')
    .eq('status', 'aguardando_pagamento');
  const pendentes = eventos.filter((e) => e.status === 'pendente');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start sm:items-center gap-3">
        <div className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2447]">Agendamentos</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Reservas das suas embarcações e roteiros — em calendário ou em lista.
            {pendentes.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
              </span>
            )}
            {(cobrancasAbertas ?? 0) > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-xs font-semibold">
                {cobrancasAbertas} cobrança{cobrancasAbertas !== 1 ? 's' : ''} adicional{cobrancasAbertas !== 1 ? 'is' : ''} em aberto
              </span>
            )}
          </p>
        </div>
      </div>

      <AgendamentosVisoes eventos={eventos} visaoInicial={visaoInicial} />
    </div>
  );
}
