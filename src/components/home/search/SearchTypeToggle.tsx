'use client';

import { MapPin, Ship, Tag } from 'lucide-react';

export type SearchType = 'roteiro' | 'embarcacao' | 'venda';

type Props = {
  value: SearchType;
  onChange: (value: SearchType) => void;
  /** 'dark' para fundos escuros (hero), 'light' para fundos claros (página de resultados). */
  variant?: 'dark' | 'light';
  /** Mostra a aba "Vendas" no seletor. Padrão true; a Home a esconde — Vendas já tem CTA próprio no Header. */
  showVendas?: boolean;
};

const OPTIONS: { id: SearchType; label: string; icon: typeof MapPin }[] = [
  { id: 'roteiro', label: 'Roteiros', icon: MapPin },
  { id: 'embarcacao', label: 'Embarcações', icon: Ship },
  { id: 'venda', label: 'Vendas', icon: Tag },
];

export default function SearchTypeToggle({ value, onChange, variant = 'dark', showVendas = true }: Props) {
  const containerClass =
    variant === 'dark'
      ? 'bg-white/15 backdrop-blur-sm'
      : 'bg-slate-100';

  const options = showVendas ? OPTIONS : OPTIONS.filter((o) => o.id !== 'venda');

  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-1 ${containerClass}`}>
      {options.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        const activeClass = 'bg-white text-[#0B2447] shadow-sm';
        const inactiveClass =
          variant === 'dark'
            ? 'text-white/80 hover:text-white'
            : 'text-slate-500 hover:text-slate-800';

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              active ? activeClass : inactiveClass
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
