'use client';

import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { formatarHora } from '@/lib/datas';
import type { Rascunho } from '@/lib/rascunhos/useRascunhoCadastro';

/**
 * Situação do rascunho automático, no rodapé das etapas (SPEC §107.4). Durante a
 * gravação (milissegundos) mantém o "salvo às…" anterior para não piscar.
 */
export default function StatusRascunho({ rascunho }: { rascunho: Rascunho }) {
  const { status, salvoEm } = rascunho;

  if (status === 'erro') {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-600">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Não foi possível guardar o rascunho neste aparelho
      </span>
    );
  }
  if (status === 'sem-arquivos') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Rascunho salvo sem as fotos (sem espaço no aparelho)
      </span>
    );
  }
  if (status === 'salvando' && !salvoEm) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando rascunho…
      </span>
    );
  }
  if ((status === 'salvo' || status === 'salvando') && salvoEm) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-500">
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Rascunho salvo neste aparelho · {formatarHora(new Date(salvoEm))}
      </span>
    );
  }
  return null;
}
