'use client';

import { AlertTriangle, Check, X } from 'lucide-react';

export type ItemRevisao = {
  label: string;
  resumo: string;
  /** ok: completo · aviso: recomendação (não bloqueia) · erro: impede salvar. */
  status: 'ok' | 'aviso' | 'erro';
  onEditar: () => void;
};

const ESTILO = {
  ok:    { cls: 'bg-emerald-50 text-emerald-700', Icon: Check },
  aviso: { cls: 'bg-amber-50 text-amber-700',     Icon: AlertTriangle },
  erro:  { cls: 'bg-red-50 text-red-600',         Icon: X },
} as const;

/** Lista da etapa "Revisão": uma linha por etapa, com resumo e atalho "Editar". */
export default function RevisaoChecklist({ itens }: { itens: ItemRevisao[] }) {
  const pendencias = itens.filter(i => i.status === 'erro').length;
  const avisos = itens.filter(i => i.status === 'aviso').length;

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        {pendencias > 0
          ? <span className="font-semibold text-red-600">Há {pendencias} {pendencias === 1 ? 'item obrigatório pendente' : 'itens obrigatórios pendentes'}.</span>
          : avisos > 0
            ? <>Tudo pronto para publicar. Há {avisos} {avisos === 1 ? 'sugestão' : 'sugestões'} para deixar a publicação mais atrativa.</>
            : <span className="font-semibold text-emerald-700">Tudo completo — pronto para publicar.</span>}
      </p>
      <ul className="space-y-2">
        {itens.map(item => {
          const { cls, Icon } = ESTILO[item.status];
          return (
            <li key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3.5 py-3">
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${cls}`}>
                <Icon className="w-3.5 h-3.5" strokeWidth={3} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500 truncate">{item.resumo}</p>
              </div>
              <button type="button" onClick={item.onEditar}
                className="shrink-0 px-2 py-1.5 rounded-lg text-[13px] font-semibold text-[#0B3D91] hover:bg-slate-50">
                Editar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
