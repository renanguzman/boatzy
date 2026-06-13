'use client';

import { MapPin, Ship } from 'lucide-react';

export type SearchType = 'roteiro' | 'embarcacao';

type Props = {
  value: SearchType;
  onChange: (value: SearchType) => void;
  /** 'dark' para fundos escuros (hero), 'light' para fundos claros (página de resultados). */
  variant?: 'dark' | 'light';
};

const OPTIONS: { id: SearchType; label: string; icon: typeof MapPin }[] = [
  { id: 'roteiro', label: 'Roteiros', icon: MapPin },
  { id: 'embarcacao', label: 'Embarcações', icon: Ship },
];

export default function SearchTypeToggle({ value, onChange, variant = 'dark' }: Props) {
  const containerClass =
    variant === 'dark'
      ? 'bg-white/15 backdrop-blur-sm'
      : 'bg-slate-100';

  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-1 ${containerClass}`}>
      {OPTIONS.map(({ id, label, icon: Icon }) => {
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
