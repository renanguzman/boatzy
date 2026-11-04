'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Campo de busca discreto da vitrine: uma pílula pequena que alarga ao
 * receber foco. Filtra a lista já carregada — não navega, não consulta o
 * servidor. `tom` acompanha o fundo (escuro sobre o vídeo, claro sobre areia).
 */
export default function BuscaDiscreta({
  valor,
  onChange,
  tom,
}: {
  valor: string;
  onChange: (v: string) => void;
  tom: 'escuro' | 'claro';
}) {
  const t = useTranslations('Hero.vitrine');
  const tComum = useTranslations('Comum');
  const escuro = tom === 'escuro';

  return (
    <div
      role="search"
      className={`group relative flex items-center w-full sm:w-80 sm:focus-within:w-96 transition-[width,background-color,box-shadow] duration-500 ease-out rounded-full ${
        escuro
          ? 'bg-white/10 ring-1 ring-white/20 backdrop-blur-md focus-within:bg-white/15 focus-within:ring-white/40'
          : 'bg-white ring-1 ring-slate-200 shadow-sm focus-within:ring-turquesa/60 focus-within:shadow-md'
      }`}
    >
      <Search
        aria-hidden
        className={`absolute left-3.5 h-4 w-4 transition-colors ${
          escuro ? 'text-white/60 group-focus-within:text-turquesa' : 'text-slate-400 group-focus-within:text-turquesa-escuro'
        }`}
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('buscaPlaceholder')}
        aria-label={t('buscaRotulo')}
        enterKeyHint="search"
        className={`w-full bg-transparent py-2.5 pl-10 pr-9 text-sm outline-none [&::-webkit-search-cancel-button]:hidden ${
          escuro ? 'text-white placeholder:text-white/55' : 'text-grafite placeholder:text-slate-400'
        }`}
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={tComum('limpar')}
          className={`absolute right-2 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
            escuro ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
