'use client';

import { useState, useTransition } from 'react';
import Spinner from '@/components/ui/Spinner';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { STATUS_INFO, type StatusPublicacaoQualquer } from '@/lib/publicacao/config';

export type OpcaoFiltroStatus = { value: StatusPublicacaoQualquer | 'todos'; count: number };

/**
 * Abas de status das listagens do administrator (parâmetro `st` na URL).
 * "Em análise" ganha destaque quando há fila.
 */
export default function FiltroStatusPublicacao({ opcoes, atual }: {
  opcoes: OpcaoFiltroStatus[];
  atual: StatusPublicacaoQualquer | 'todos';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendente, startTransition] = useTransition();
  const [alvo, setAlvo] = useState<string | null>(null);

  function selecionar(value: OpcaoFiltroStatus['value']) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('st', value);
    params.delete('page');
    setAlvo(value);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {opcoes.map(({ value, count }) => {
        const ativo = value === atual;
        const label = value === 'todos' ? 'Todos' : STATUS_INFO[value].label;
        const fila = value === 'em_analise' && count > 0;
        return (
          <button
            key={value}
            type="button"
            onClick={() => selecionar(value)}
            aria-busy={pendente && alvo === value}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              ativo
                ? 'border-marinho bg-marinho text-white'
                : fila
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {pendente && alvo === value && <Spinner tamanho={12} />}
            {label}
            <span className={`rounded-full px-1.5 py-px text-[10px] ${
              ativo ? 'bg-white/20' : fila ? 'bg-amber-200/70' : 'bg-slate-100 text-slate-500'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
