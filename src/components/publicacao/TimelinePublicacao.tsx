import { History, Lock, MessageSquare } from 'lucide-react';
import { formatarDataHora } from '@/lib/datas';
import {
  STATUS_INFO, TIPO_EVENTO_LABEL, rotuloCampos, type StatusPublicacaoQualquer,
} from '@/lib/publicacao/config';
import type { EventoTimeline } from '@/lib/publicacao/server';
import StatusPublicacaoBadge from './StatusPublicacaoBadge';

/**
 * Histórico de status de uma publicação, do mais recente ao mais antigo:
 * data/hora (Brasília), o que aconteceu, status resultante, quem fez,
 * observação e campos alterados. A observação interna só chega preenchida
 * na visão do admin.
 */
export default function TimelinePublicacao({ eventos, titulo = 'Histórico de status' }: {
  eventos: EventoTimeline[]; titulo?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <History className="w-4 h-4 text-[#0B2447]" />
        <h2 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase">{titulo}</h2>
      </div>

      {eventos.length === 0 ? (
        <p className="px-6 py-6 text-sm text-slate-400">Nenhuma mudança de status registrada.</p>
      ) : (
        <ol className="px-6 py-5">
          {eventos.map((e, i) => {
            const status = e.statusNovo as StatusPublicacaoQualquer;
            const ultimo = i === eventos.length - 1;
            return (
              <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                {!ultimo && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200" aria-hidden />}
                <span className={`relative mt-1.5 h-[11px] w-[11px] flex-shrink-0 rounded-full ring-4 ring-white ${STATUS_INFO[status]?.dot ?? 'bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-slate-800">{TIPO_EVENTO_LABEL[e.tipo] ?? e.tipo}</p>
                    {STATUS_INFO[status] && <StatusPublicacaoBadge status={status} />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatarDataHora(e.createdAt)}
                    {e.atorNome && <> · {e.atorNome}</>}
                    {!e.atorNome && e.atorPapel === 'sistema' && <> · Sistema</>}
                  </p>

                  {e.camposAlterados && e.camposAlterados.length > 0 && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold">Campos alterados:</span> {rotuloCampos(e.camposAlterados)}
                    </p>
                  )}

                  {e.observacao && (
                    <div className="mt-2 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <p className="text-sm text-slate-700 whitespace-pre-line">{e.observacao}</p>
                    </div>
                  )}

                  {e.observacaoInterna && (
                    <div className="mt-2 flex gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
                      <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-500" />
                      <p className="text-sm text-violet-900 whitespace-pre-line">
                        <span className="font-semibold">Interna:</span> {e.observacaoInterna}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
