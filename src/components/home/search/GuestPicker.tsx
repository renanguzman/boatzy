'use client';

import { Minus, Plus } from 'lucide-react';

type Props = {
  value: number;
  onChange: (value: number) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
  /** Renderiza o seletor como stepper inline (número sempre visível, sem dropdown). */
  inline?: boolean;
  /** Rótulo do campo — padrão "Pessoas". Usado também para "Diárias" no modelo Por Diária. */
  label?: string;
  /** Palavra no singular/plural do valor (ex: "diária"/"diárias"). Padrão "pessoa"/"pessoas". */
  singular?: string;
  plural?: string;
  /** Valor mínimo permitido (padrão 0). */
  min?: number;
  /** Valor máximo permitido — sem teto quando omitido. */
  max?: number;
};

export default function GuestPicker({
  value,
  onChange,
  isOpen,
  onOpen,
  onClose,
  compact,
  inline,
  label = 'Pessoas',
  singular = 'pessoa',
  plural = 'pessoas',
  min = 0,
  max,
}: Props) {
  function decrement() {
    onChange(Math.max(min, value - 1));
  }

  function increment() {
    onChange(max != null ? Math.min(max, value + 1) : value + 1);
  }

  const podeDecrementar = value > min;
  const podeIncrementar = max == null || value < max;

  // Modo inline: rótulo + stepper (- N +) sempre visível, ocupando a linha inteira.
  if (inline) {
    return (
      <div className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 hover:bg-slate-50 transition-colors min-w-0">
        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
          {label}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={decrement}
            disabled={!podeDecrementar}
            aria-label={`Remover ${singular}`}
            className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors ${
              !podeDecrementar
                ? 'border-slate-200 text-slate-300 cursor-default'
                : 'border-slate-400 text-slate-700 hover:border-slate-800 hover:text-slate-800'
            }`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-5 text-center text-base font-semibold text-slate-800 tabular-nums">
            {value}
          </span>
          <button
            type="button"
            onClick={increment}
            disabled={!podeIncrementar}
            aria-label={`Adicionar ${singular}`}
            className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors ${
              !podeIncrementar
                ? 'border-slate-200 text-slate-300 cursor-default'
                : 'border-slate-400 text-slate-700 hover:border-slate-800 hover:text-slate-800'
            }`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      {/* Field trigger */}
      <button
        type="button"
        onClick={isOpen ? onClose : onOpen}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-slate-800 bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {label}
        </span>
        {value > 0 ? (
          <span className={`font-medium text-slate-800 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
            {value} {value === 1 ? singular : plural}
          </span>
        ) : (
          <span className={`text-slate-400 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>Quantas?</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-56 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4 text-center">Tamanho do grupo</p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={decrement}
              disabled={!podeDecrementar}
              className={`h-9 w-9 rounded-full border-2 flex items-center justify-center transition-colors ${
                !podeDecrementar
                  ? 'border-slate-200 text-slate-300 cursor-default'
                  : 'border-slate-400 text-slate-700 hover:border-slate-800 hover:text-slate-800'
              }`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="h-12 w-16 rounded-xl border-2 border-[#0B3D91] flex items-center justify-center">
              <span className="text-xl font-semibold text-slate-800">{value}</span>
            </div>
            <button
              type="button"
              onClick={increment}
              disabled={!podeIncrementar}
              className={`h-9 w-9 rounded-full border-2 flex items-center justify-center transition-colors ${
                !podeIncrementar
                  ? 'border-slate-200 text-slate-300 cursor-default'
                  : 'border-slate-400 text-slate-700 hover:border-slate-800 hover:text-slate-800'
              }`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {max != null && (
            <p className="mt-3 text-center text-xs text-slate-400">Máximo de {max} {max === 1 ? singular : plural}</p>
          )}
        </div>
      )}
    </div>
  );
}
