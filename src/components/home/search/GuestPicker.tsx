'use client';

import { Minus, Plus } from 'lucide-react';

type Props = {
  value: number;
  onChange: (value: number) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

export default function GuestPicker({ value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  function decrement() {
    onChange(Math.max(0, value - 1));
  }

  function increment() {
    onChange(value + 1);
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
          Pessoas
        </span>
        {value > 0 ? (
          <span className={`font-medium text-slate-800 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
            {value} {value === 1 ? 'pessoa' : 'pessoas'}
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
              disabled={value <= 0}
              className={`h-9 w-9 rounded-full border-2 flex items-center justify-center transition-colors ${
                value <= 0
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
              className="h-9 w-9 rounded-full border-2 border-slate-400 text-slate-700 flex items-center justify-center hover:border-slate-800 hover:text-slate-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
