'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DOW_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Converte um Date local para string ISO 'yyyy-mm-dd' (sem deslocamento de fuso). */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

type Props = {
  /** Dias da semana em que o roteiro opera (0=Dom..6=Sáb). Vazio = todos os dias. */
  diasSemana: number[];
  onDiasSemanaChange: (dias: number[]) => void;
  /** Datas bloqueadas (exceções), em formato ISO 'yyyy-mm-dd'. */
  bloqueios: string[];
  onBloqueiosChange: (datas: string[]) => void;
};

export default function DisponibilidadePicker({
  diasSemana, onDiasSemanaChange, bloqueios, onBloqueiosChange,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const operaTodos = diasSemana.length === 0;
  const bloqueioSet = new Set(bloqueios);

  function toggleDia(day: number) {
    onDiasSemanaChange(
      diasSemana.includes(day)
        ? diasSemana.filter(d => d !== day)
        : [...diasSemana, day].sort((a, b) => a - b),
    );
  }

  function toggleBloqueio(iso: string) {
    onBloqueiosChange(
      bloqueioSet.has(iso)
        ? bloqueios.filter(b => b !== iso)
        : [...bloqueios, iso].sort(),
    );
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  return (
    <div className="space-y-6">
      {/* Dias da semana de operação */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Dias da semana em que o roteiro opera</p>
        <div className="flex gap-2 flex-wrap">
          {DIAS_SEMANA.map(d => {
            const active = diasSemana.includes(d.value);
            return (
              <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
                className={`w-12 h-10 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0B2447]/30'
                }`}>
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {operaTodos
            ? '💡 Nenhum dia selecionado: o roteiro fica disponível em todos os dias (exceto as datas bloqueadas abaixo).'
            : 'O roteiro só ficará disponível nos dias selecionados.'}
        </p>
      </div>

      {/* Calendário de bloqueios */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Bloquear datas específicas (exceções)</p>
        <div className="rounded-xl border border-slate-200 bg-white p-4 max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} disabled={!canGoPrev}
              className={`p-1.5 rounded-full transition-colors ${
                canGoPrev ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-default'
              }`}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-slate-800">{MESES[viewMonth]} {viewYear}</p>
            <button type="button" onClick={nextMonth}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {DOW_CURTOS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-slate-400 pb-1">{d}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={`e-${i}`} />;
              const iso = toISO(date);
              const isPast = date < today;
              const foraOperacao = !operaTodos && !diasSemana.includes(date.getDay());
              const bloqueado = bloqueioSet.has(iso);
              const indisponivel = isPast || foraOperacao;

              return (
                <button key={iso} type="button"
                  disabled={indisponivel}
                  onClick={() => toggleBloqueio(iso)}
                  title={
                    isPast ? 'Data passada'
                    : foraOperacao ? 'Fora dos dias de operação'
                    : bloqueado ? 'Bloqueado — clique para liberar'
                    : 'Disponível — clique para bloquear'
                  }
                  className={[
                    'h-9 w-full rounded-lg text-xs transition-colors flex items-center justify-center',
                    isPast ? 'text-slate-300 cursor-default'
                      : foraOperacao ? 'text-slate-300 line-through cursor-default'
                      : bloqueado ? 'bg-red-500 text-white font-semibold'
                      : 'text-slate-700 hover:bg-red-50 hover:text-red-600',
                  ].join(' ')}>
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Bloqueado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-slate-200 inline-block" /> Disponível</span>
            <span className="line-through">Fora de operação</span>
          </div>
        </div>

        {/* Lista de datas bloqueadas */}
        {bloqueios.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {bloqueios.map(iso => (
              <span key={iso}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full pl-3 pr-2 py-1">
                {fmtBR(iso)}
                <button type="button" onClick={() => toggleBloqueio(iso)}
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-200 transition-colors"
                  aria-label={`Remover bloqueio de ${fmtBR(iso)}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
