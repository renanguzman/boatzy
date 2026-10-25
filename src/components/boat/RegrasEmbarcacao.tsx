import { Ban, ShieldAlert } from 'lucide-react';

/**
 * Regras a bordo definidas pelo dono (`embarcacao.regras`) — sempre visíveis, logo abaixo de
 * "O que esta embarcação possui", no detalhe do roteiro e na página da embarcação. Vermelho é cor
 * semântica (proibição/atenção), fora da paleta de marca, como os avisos de erro.
 */
export default function RegrasEmbarcacao({ regras }: { regras: string[] | null | undefined }) {
  if (!regras || regras.length === 0) return null;

  return (
    <section aria-label="Regras a bordo" className="rounded-xl border border-red-100 bg-white overflow-hidden">
      <h3 className="flex items-center gap-2 border-b border-red-100 bg-red-50/60 px-4 py-2.5">
        <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
        <span className="text-sm font-semibold text-marinho">Regras a bordo</span>
        <span className="ml-auto text-[11px] font-medium text-slate-400 tabular-nums">
          {regras.length} {regras.length === 1 ? 'regra' : 'regras'}
        </span>
      </h3>
      <ul className="divide-y divide-slate-100 px-4">
        {regras.map((regra) => (
          <li key={regra} className="flex items-start gap-2.5 py-2.5 text-sm leading-snug text-red-700">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-500" strokeWidth={2} />
            <span>{regra}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
