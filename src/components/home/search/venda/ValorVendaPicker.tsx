'use client';

import { useState } from 'react';
import { valorVendaLabel, valorCompacto } from './labels';

export type ValorVendaValue = { min: string; max: string };

// Re-export para os call sites que já importavam daqui.
export { valorVendaLabel, valorCompacto };

type Props = {
  value: ValorVendaValue;
  onChange: (value: ValorVendaValue) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

const inputCls = `w-full rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;

export default function ValorVendaPicker({ value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  const [draft, setDraft] = useState<ValorVendaValue>(value);

  const label = valorVendaLabel(value);

  function abrir() {
    setDraft(value);
    onOpen();
  }

  function aplicar() {
    // Normaliza faixa invertida (min > max) trocando os extremos.
    let { min, max } = draft;
    if (min && max && parseFloat(min) > parseFloat(max)) [min, max] = [max, min];
    onChange({ min, max });
    onClose();
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={isOpen ? onClose : abrir}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-slate-800 bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          Valor
        </span>
        {label ? (
          <span className={`font-medium text-slate-800 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
            {label}
          </span>
        ) : (
          <span className={`text-slate-400 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>Qualquer valor</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-80 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Faixa de valor
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">R$</span>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1000"
                placeholder="Mínimo"
                value={draft.min}
                onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
              />
            </div>
            <span className="text-slate-400 text-sm shrink-0">até</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">R$</span>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1000"
                placeholder="Máximo"
                value={draft.max}
                onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={() => setDraft({ min: '', max: '' })}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={aplicar}
              className="px-4 py-2 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-xs font-semibold transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
