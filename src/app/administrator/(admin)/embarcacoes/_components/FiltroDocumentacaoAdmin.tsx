'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import type { FiltroDocumentacao } from '@/lib/documentos/admin';
import { DIAS_ALERTA } from '@/lib/documentos/validade';

const OPCOES: { value: FiltroDocumentacao; label: string; ponto: string; ativo: string; destaque?: string }[] = [
  {
    value: 'vencida', label: 'Vencida', ponto: 'bg-red-500', ativo: 'border-red-600 bg-red-600 text-white',
    destaque: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  },
  { value: 'nao_enviada', label: 'Não enviada', ponto: 'bg-slate-300', ativo: 'border-marinho bg-marinho text-white' },
  { value: 'em_dia', label: 'Em dia', ponto: 'bg-emerald-500', ativo: 'border-emerald-600 bg-emerald-600 text-white' },
];

/**
 * Filtro da lista de embarcações do admin pela documentação (parâmetro `doc`,
 * SPEC §95.9). "Vencida" ganha destaque quando há alguma; "Vence em até 60 dias"
 * fica à parte — o admin só vê o que está para vencer quando pede.
 */
export default function FiltroDocumentacaoAdmin({ atual, contagem }: {
  atual: FiltroDocumentacao | null;
  contagem: Record<FiltroDocumentacao, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function selecionar(value: FiltroDocumentacao | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('doc', value);
    else params.delete('doc');
    params.delete('page');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const chip = 'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition';
  const contador = (ativo: boolean, n: number) => (
    <span className={`rounded-full px-1.5 py-px text-[10px] ${ativo ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
  );

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <FileText className="h-3.5 w-3.5" /> Documentação
      </span>
      <button
        type="button"
        onClick={() => selecionar(null)}
        className={`${chip} ${atual === null ? 'border-marinho bg-marinho text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        Todas
      </button>
      {OPCOES.map((o) => {
        const ativo = atual === o.value;
        const n = contagem[o.value];
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => selecionar(ativo ? null : o.value)}
            aria-pressed={ativo}
            className={`${chip} ${ativo ? o.ativo : n > 0 && o.destaque ? o.destaque : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {!ativo && <span className={`h-1.5 w-1.5 rounded-full ${o.ponto}`} />}
            {o.label}
            {contador(ativo, n)}
          </button>
        );
      })}
      <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
      <button
        type="button"
        onClick={() => selecionar(atual === 'vencendo' ? null : 'vencendo')}
        aria-pressed={atual === 'vencendo'}
        title={`Embarcações com algum documento que vence nos próximos ${DIAS_ALERTA} dias`}
        className={`${chip} ${atual === 'vencendo' ? 'border-amber-500 bg-amber-500 text-white' : 'border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50'}`}
      >
        Vence em até {DIAS_ALERTA} dias
        {contador(atual === 'vencendo', contagem.vencendo)}
      </button>
    </div>
  );
}
