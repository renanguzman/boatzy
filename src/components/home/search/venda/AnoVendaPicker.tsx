'use client';

import { useState } from 'react';
import { anoVendaLabel } from './labels';

export type AnoVendaValue = { min: string; max: string };

// Re-export para os call sites que já importavam daqui.
export { anoVendaLabel };

type Props = {
  value: AnoVendaValue;
  onChange: (value: AnoVendaValue) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

const inputCls = `w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;

export default function AnoVendaPicker({ value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  // Rascunho local: só aplica ao confirmar (evita re-busca a cada tecla no futuro).
  const [draft, setDraft] = useState<AnoVendaValue>(value);

  const label = anoVendaLabel(value);
  const anoAtual = new Date().getFullYear();

  function abrir() {
    setDraft(value);
    onOpen();
  }

  function aplicar() {
    // Normaliza faixa invertida (min > max) trocando os extremos.
    let { min, max } = draft;
    if (min && max && parseInt(min) > parseInt(max)) [min, max] = [max, min];
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
          Ano
        </span>
        {label ? (
          <span className={`font-medium text-slate-800 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
            {label}
          </span>
        ) : (
          <span className={`text-slate-400 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>Qualquer ano</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-72 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Ano do modelo
          </p>
          <div className="flex items-center gap-2">
            <input
              className={inputCls}
              type="number"
              min={1900}
              max={anoAtual + 1}
              placeholder="De"
              value={draft.min}
              onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
            />
            <span className="text-slate-400 text-sm shrink-0">até</span>
            <input
              className={inputCls}
              type="number"
              min={1900}
              max={anoAtual + 1}
              placeholder="Até"
              value={draft.max}
              onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
            />
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
