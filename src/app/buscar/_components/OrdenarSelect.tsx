'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';
import {
  ORDENACOES,
  ORDENACAO_PADRAO,
  buildBuscarUrl,
  type BuscaSearchParams,
  type Ordenacao,
} from '../_lib/filtros';

type Props = {
  /** Params atuais da URL — vêm da página (Server Component). */
  params: BuscaSearchParams;
  valor: Ordenacao;
};

export default function OrdenarSelect({ params, valor }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novo = e.target.value as Ordenacao;
    router.push(
      buildBuscarUrl(params, {
        // O padrão não vai para a URL (mantém links limpos e compartilháveis).
        ordenar: novo === ORDENACAO_PADRAO ? null : novo,
        pagina: null, // mudou a ordem: volta para a primeira página
      }),
    );
  }

  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-500 shrink-0">
      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
      <span className="hidden sm:inline">Ordenar por</span>
      <select
        value={valor}
        onChange={handleChange}
        className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700
          focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition cursor-pointer"
      >
        {ORDENACOES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
