'use client';

import { useState } from 'react';
import { CalendarDays, ListOrdered } from 'lucide-react';
import clsx from 'clsx';
import AgendamentosCalendar, { type ReservaEvento } from './AgendamentosCalendar';
import ReservasLista from './ReservasLista';
import PendentesList from './PendentesList';
import { salvarVisao, type VisaoAgendamentos } from './visao';

const VISOES: { id: VisaoAgendamentos; label: string; Icon: typeof CalendarDays }[] = [
  { id: 'calendario', label: 'Calendário', Icon: CalendarDays },
  { id: 'lista', label: 'Lista de reservas', Icon: ListOrdered },
];

/**
 * Abas Calendário / Lista de reservas. A última aba vista fica num cookie
 * (lido pela página no servidor), então o gestor volta direto nela.
 */
export default function AgendamentosVisoes({
  eventos,
  visaoInicial,
}: {
  eventos: ReservaEvento[];
  visaoInicial: VisaoAgendamentos;
}) {
  const [visao, setVisao] = useState<VisaoAgendamentos>(visaoInicial);
  const pendentes = eventos.filter((e) => e.status === 'pendente');

  function escolher(v: VisaoAgendamentos) {
    setVisao(v);
    salvarVisao(v);
  }

  return (
    <>
      <div role="tablist" aria-label="Visualização" className="mb-4 inline-flex w-full sm:w-auto items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {VISOES.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={visao === id}
            onClick={() => escolher(id)}
            className={clsx(
              'flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              visao === id ? 'bg-[#0B2447] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-[#0B2447]',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {visao === 'lista' ? (
        <ReservasLista eventos={eventos} />
      ) : pendentes.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-10 gap-5 items-start">
          <div className="xl:col-span-7">
            <AgendamentosCalendar eventos={eventos} />
          </div>
          {/* No mobile os pendentes vêm antes do calendário: são o que pede ação. */}
          <div className="xl:col-span-3 order-first xl:order-none">
            <PendentesList pendentes={pendentes} />
          </div>
        </div>
      ) : (
        <AgendamentosCalendar eventos={eventos} />
      )}
    </>
  );
}
