'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Send, Trash2, CopyPlus, Archive, Loader2 } from 'lucide-react';
import { useTermoAcoes, type TermoResumo } from './useTermoAcoes';

const btnBase =
  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';

/** Ações disponíveis na tela de visualização, conforme o status da versão. */
export default function TermoAcoesPainel({ termo }: { termo: TermoResumo }) {
  const router = useRouter();
  const { confirmar, novaVersao, novaVersaoId, modal } = useTermoAcoes({
    aposExcluir: () => router.push('/administrator/termos'),
  });

  return (
    <div className="space-y-2">
      {termo.status === 'rascunho' ? (
        <>
          <button
            type="button"
            onClick={() => confirmar('publicar', termo)}
            className={`${btnBase} bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10`}
          >
            <Send className="w-4 h-4" /> Publicar versão
          </button>
          <Link
            href={`/administrator/termos/${termo.id}/editar`}
            className={`${btnBase} border border-slate-200 text-slate-600 hover:bg-slate-50`}
          >
            <Pencil className="w-4 h-4" /> Editar rascunho
          </Link>
          <button
            type="button"
            onClick={() => confirmar('excluir', termo)}
            className={`${btnBase} text-red-600 hover:bg-red-50`}
          >
            <Trash2 className="w-4 h-4" /> Excluir rascunho
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => novaVersao(termo)}
            disabled={!!novaVersaoId}
            className={`${btnBase} bg-[#0B2447] hover:bg-[#0B3D91] text-white shadow-md shadow-[#0B2447]/10`}
          >
            {novaVersaoId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />}
            Criar nova versão
          </button>
          {termo.status === 'publicado' && (
            <button
              type="button"
              onClick={() => confirmar('arquivar', termo)}
              className={`${btnBase} text-amber-700 hover:bg-amber-50`}
            >
              <Archive className="w-4 h-4" /> Retirar de vigência
            </button>
          )}
        </>
      )}

      {modal}
    </div>
  );
}
