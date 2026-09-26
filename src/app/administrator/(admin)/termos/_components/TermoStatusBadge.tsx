import type { TermoUsoStatus } from '@/types/supabase';

const STATUS: Record<TermoUsoStatus, { label: string; cls: string }> = {
  rascunho:  { label: 'Rascunho',  cls: 'bg-slate-100 text-slate-600' },
  publicado: { label: 'Vigente',   cls: 'bg-emerald-50 text-emerald-700' },
  arquivado: { label: 'Arquivado', cls: 'bg-amber-50 text-amber-700' },
};

export default function TermoStatusBadge({ status }: { status: TermoUsoStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}
