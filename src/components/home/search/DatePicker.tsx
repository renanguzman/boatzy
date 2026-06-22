'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type DateValue = {
  date: Date;
  flexibility: 0 | 1 | 2 | 3 | 7;
};

type Props = {
  value: DateValue | null;
  onChange: (value: DateValue | null) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const FLEX_OPTIONS: { label: string; value: DateValue['flexibility'] }[] = [
  { label: 'Data exata', value: 0 },
  { label: '±1 dia', value: 1 },
  { label: '±2 dias', value: 2 },
  { label: '±3 dias', value: 3 },
  { label: '±7 dias', value: 7 },
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isInRange(day: Date, center: Date, flex: number) {
  if (flex === 0) return false;
  const diff = Math.abs(day.getTime() - center.getTime()) / 86400000;
  return diff <= flex && diff > 0;
}

function formatDateDisplay(v: DateValue) {
  const d = v.date;
  const dia = d.getDate();
  const mes = MESES_CURTOS[d.getMonth()];
  if (v.flexibility === 0) return `${dia} de ${mes}.`;
  return `${dia} de ${mes}. ±${v.flexibility} ${v.flexibility === 1 ? 'dia' : 'dias'}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

type MonthCalendarProps = {
  year: number;
  month: number;
  selected: Date | null;
  flexibility: DateValue['flexibility'];
  today: Date;
  onSelect: (date: Date) => void;
};

function MonthCalendar({ year, month, selected, flexibility, today, onSelect }: MonthCalendarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="flex-1">
      <p className="text-center text-sm font-semibold text-slate-800 mb-3">
        {MESES[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-slate-400 pb-1">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />;

          const isPast = date < today && !isSameDay(date, today);
          const isSelected = selected ? isSameDay(date, selected) : false;
          const inRange = selected ? isInRange(date, selected, flexibility) : false;

          return (
            <button
              key={date.getDate()}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && onSelect(date)}
              className={[
                'h-9 w-full rounded-full text-sm transition-colors flex items-center justify-center',
                isPast
                  ? 'text-slate-300 cursor-default'
                  : isSelected
                  ? 'bg-[#0B3D91] text-white font-semibold shadow'
                  : inRange
                  ? 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200'
                  : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DatePicker({ value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [tempDate, setTempDate] = useState<Date | null>(value?.date ?? null);
  const [tempFlex, setTempFlex] = useState<DateValue['flexibility']>(value?.flexibility ?? 0);

  function handleOpen() {
    setTempDate(value?.date ?? null);
    setTempFlex(value?.flexibility ?? 0);
    onOpen();
  }

  function handleSelectDay(date: Date) {
    setTempDate(date);
    onChange({ date, flexibility: tempFlex });
  }

  function handleFlexChange(flex: DateValue['flexibility']) {
    setTempFlex(flex);
    if (tempDate) {
      onChange({ date: tempDate, flexibility: flex });
    }
  }

  function handleConfirm() {
    if (tempDate) {
      onChange({ date: tempDate, flexibility: tempFlex });
    }
    onClose();
  }

  function handleClear() {
    setTempDate(null);
    setTempFlex(0);
    onChange(null);
    onClose();
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  return (
    <div className="relative flex-1 min-w-0">
      {/* Field trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-slate-800 bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          Data
        </span>
        {value ? (
          <span className={`font-medium text-slate-800 truncate block ${compact ? 'text-xs' : 'text-sm'}`}>
            {formatDateDisplay(value)}
          </span>
        ) : (
          <span className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>Quando?</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-[620px] max-w-[95vw] p-4">
          {/* Navigation header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canGoPrev}
              className={`p-2 rounded-full transition-colors ${
                canGoPrev ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-default'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Two-month grid */}
          <div className="flex gap-6">
            <MonthCalendar
              year={viewYear}
              month={viewMonth}
              selected={tempDate}
              flexibility={tempFlex}
              today={today}
              onSelect={handleSelectDay}
            />
            <div className="w-px bg-slate-100 shrink-0" />
            <MonthCalendar
              year={secondYear}
              month={secondMonth}
              selected={tempDate}
              flexibility={tempFlex}
              today={today}
              onSelect={handleSelectDay}
            />
          </div>

          {/* Flexibility options */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
            {FLEX_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleFlexChange(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  tempFlex === opt.value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-500 underline hover:text-slate-800 transition-colors"
            >
              Limpar datas
            </button>
          </div>

          {/* Confirm button */}
          {tempDate && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 bg-[#0B3D91] hover:bg-[#092E6E] text-white rounded-xl text-sm font-medium transition-colors"
              >
                Confirmar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
