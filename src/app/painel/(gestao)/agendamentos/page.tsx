import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CalendarDays } from 'lucide-react';

export default async function AgendamentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <CalendarDays className="w-6 h-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agendamentos</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Gerencie as reservas das suas embarcações.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <CalendarDays className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium">Nenhum agendamento encontrado</p>
        <p className="text-slate-400 text-sm mt-1">Os agendamentos das suas embarcações aparecerão aqui.</p>
      </div>
    </div>
  );
}
