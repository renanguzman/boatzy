'use client';

import { useTranslations } from 'next-intl';
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

// `rotulo` = chave em `Navegacao` (mesmos nomes do menu principal).
const OPTIONS: { id: SearchType; rotulo: 'roteiros' | 'embarcacoes' | 'vendas'; icon: typeof MapPin }[] = [
  { id: 'roteiro', rotulo: 'roteiros', icon: MapPin },
  { id: 'embarcacao', rotulo: 'embarcacoes', icon: Ship },
  { id: 'venda', rotulo: 'vendas', icon: Tag },
];

export default function SearchTypeToggle({ value, onChange, variant = 'dark', showVendas = true }: Props) {
  const t = useTranslations('Navegacao');
  const containerClass =
    variant === 'dark'
      ? 'bg-white/15 backdrop-blur-sm'
      : 'bg-slate-100';

  const options = showVendas ? OPTIONS : OPTIONS.filter((o) => o.id !== 'venda');

  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-1 ${containerClass}`}>
      {options.map(({ id, rotulo, icon: Icon }) => {
        const active = value === id;
        const activeClass = 'bg-white text-marinho shadow-sm';
        const inactiveClass =
          variant === 'dark'
            ? 'text-white/80 hover:text-white'
            : 'text-slate-500 hover:text-grafite';

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
            {t(rotulo)}
          </button>
        );
      })}
    </div>
  );
}
