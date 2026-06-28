import Link from 'next/link';
import { MapPin, Ship, Users, Clock } from 'lucide-react';
import type { ReservaEvento } from './AgendamentosCalendar';

function formatData(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PendentesList({ pendentes }: { pendentes: ReservaEvento[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <h2 className="text-sm font-bold text-[#0B2447]">Pendentes</h2>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
          {pendentes.length}
        </span>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {pendentes.map((p) => {
          const Icon = p.tipo === 'embarcacao' ? Ship : MapPin;
          return (
            <Link
              key={p.id}
              href={`/painel/agendamentos/${p.id}`}
              className="group block px-4 py-3 transition-colors hover:bg-amber-50/50"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-[#0B2447]">
                    {p.cliente?.name ?? '—'}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.item_nome}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatData(p.data_reserva)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {p.quantidade_pessoas}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
