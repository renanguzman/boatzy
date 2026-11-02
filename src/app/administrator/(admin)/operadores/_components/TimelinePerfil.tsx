import { History, Lock, MessageSquare } from 'lucide-react';
import { formatarDataHora } from '@/lib/datas';
import type { EventoPerfil } from '@/lib/operador';

const ROTULO: Record<string, string> = {
  enviado: 'Enviado para análise',
  recolhido: 'Recolhido pelo gestor (edição sem reenviar)',
  aprovado: 'Aprovado e publicado',
  devolvido: 'Devolvido para ajustes',
  retirado: 'Retirado do ar',
  restaurado: 'Restaurado no ar',
};

const PONTO: Record<string, string> = {
  enviado: 'bg-amber-500', recolhido: 'bg-slate-400', aprovado: 'bg-emerald-500',
  devolvido: 'bg-orange-500', retirado: 'bg-red-500', restaurado: 'bg-sky-500',
};

/**
 * Histórico do perfil, do mais recente ao mais antigo. A observação interna só chega
 * preenchida na visão do admin (`listarEventosPerfil` com `incluirInterna`).
 */
export default function TimelinePerfil({ eventos }: { eventos: EventoPerfil[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <History className="h-4 w-4 text-marinho" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-marinho">Histórico</h2>
      </div>
      {eventos.length === 0 ? (
        <p className="px-6 py-6 text-sm text-slate-400">Nenhuma movimentação ainda.</p>
      ) : (
        <ol className="px-6 py-5">
          {eventos.map((e, i) => (
            <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < eventos.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200" />}
              <span className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white ${PONTO[e.tipo] ?? 'bg-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-grafite">{ROTULO[e.tipo] ?? e.tipo}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatarDataHora(e.criadoEm)} · {e.atorPapel === 'admin' ? 'Equipe Boatzy' : 'Gestor'}
                </p>
                {e.observacao && (
                  <div className="mt-2 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <p className="whitespace-pre-line text-sm text-slate-700">{e.observacao}</p>
                  </div>
                )}
                {e.observacaoInterna && (
                  <div className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <p className="whitespace-pre-line text-sm text-amber-900"><span className="font-semibold">Interna:</span> {e.observacaoInterna}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
