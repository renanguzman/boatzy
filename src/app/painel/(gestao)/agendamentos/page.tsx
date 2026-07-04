import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { concluirReservasVencidas } from '@/lib/reservas';
import AgendamentosCalendar, { type ReservaEvento } from './_components/AgendamentosCalendar';
import PendentesList from './_components/PendentesList';

export default async function AgendamentosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Transição lazy confirmada → concluída (data já passou) antes de listar.
  await concluirReservasVencidas();

  // Todas as reservas dos roteiros/embarcações deste gestor (owner_id).
  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, tipo, data_reserva, status, item_nome, quantidade_pessoas,
       cliente:users!reserva_cliente_id_fkey ( name )`,
    )
    .eq('owner_id', user.id)
    .order('data_reserva', { ascending: true });

  const eventos = (data ?? []) as unknown as ReservaEvento[];
  const pendentes = eventos.filter((e) => e.status === 'pendente');
  const temPendentes = pendentes.length > 0;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Agendamentos</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Calendário de reservas das suas embarcações e roteiros.
            {temPendentes && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {temPendentes ? (
        <div className="grid grid-cols-1 xl:grid-cols-10 gap-5 items-start">
          <div className="xl:col-span-7">
            <AgendamentosCalendar eventos={eventos} />
          </div>
          <div className="xl:col-span-3">
            <PendentesList pendentes={pendentes} />
          </div>
        </div>
      ) : (
        <AgendamentosCalendar eventos={eventos} />
      )}
    </div>
  );
}
