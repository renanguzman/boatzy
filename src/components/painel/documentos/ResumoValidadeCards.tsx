'use client';

import Link from 'next/link';
import { AlertOctagon, CircleCheck, Clock, FileQuestion, type LucideIcon } from 'lucide-react';
import { DIAS_ALERTA, type ResumoValidade } from '@/lib/documentos/validade';

export type FiltroSituacao = 'vencido' | 'vence_em_breve' | 'em_dia' | 'pendente';

type Cartao = {
  id: FiltroSituacao;
  rotulo: string;
  valor: number;
  ajuda: string;
  icone: LucideIcon;
  /** Cores quando há itens (com zero, o cartão fica neutro). */
  ativo: { borda: string; fundo: string; icone: string; numero: string };
};

/**
 * Quatro contadores do painel de validade (SPEC §95.6). Na tela de
 * Documentos filtram a lista (`onSelecionar`); no dashboard são links.
 */
export default function ResumoValidadeCards({
  resumo,
  selecionado = null,
  onSelecionar,
  hrefBase,
}: {
  resumo: ResumoValidade;
  selecionado?: FiltroSituacao | null;
  onSelecionar?: (f: FiltroSituacao | null) => void;
  /** Ex.: '/painel/documentos' → cada cartão vira link com ?situacao=. */
  hrefBase?: string;
}) {
  const cartoes: Cartao[] = [
    {
      id: 'vencido', rotulo: 'Vencidos', valor: resumo.vencidos, ajuda: 'Renove o quanto antes', icone: AlertOctagon,
      ativo: { borda: 'border-red-200', fundo: 'bg-red-50/60', icone: 'bg-red-100 text-red-600', numero: 'text-red-700' },
    },
    {
      id: 'vence_em_breve', rotulo: 'Vencem em breve', valor: resumo.venceEmBreve, ajuda: `Nos próximos ${DIAS_ALERTA} dias`, icone: Clock,
      ativo: { borda: 'border-amber-200', fundo: 'bg-amber-50/60', icone: 'bg-amber-100 text-amber-600', numero: 'text-amber-700' },
    },
    {
      id: 'em_dia', rotulo: 'Em dia', valor: resumo.emDia, ajuda: 'Nada a fazer agora', icone: CircleCheck,
      ativo: { borda: 'border-emerald-200', fundo: 'bg-white', icone: 'bg-emerald-50 text-emerald-600', numero: 'text-[#0B2447]' },
    },
    {
      id: 'pendente', rotulo: 'Pendentes', valor: resumo.pendentes, ajuda: 'Embarcações sem TIE/TIEM', icone: FileQuestion,
      ativo: { borda: 'border-slate-300 border-dashed', fundo: 'bg-white', icone: 'bg-slate-100 text-slate-500', numero: 'text-[#0B2447]' },
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cartoes.map((c) => {
        const temItens = c.valor > 0;
        const marcado = selecionado === c.id;
        const classe = `group relative rounded-2xl border p-3 sm:p-4 text-left shadow-sm transition-all min-w-0 ${
          temItens ? `${c.ativo.borda} ${c.ativo.fundo}` : 'border-slate-100 bg-white'
        } ${marcado ? 'ring-2 ring-[#0B2447]/30' : ''} ${onSelecionar || hrefBase ? 'hover:shadow-md' : ''}`;
        const conteudo = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-snug">{c.rotulo}</p>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${temItens ? c.ativo.icone : 'bg-slate-50 text-slate-300'}`}>
                <c.icone className="h-4 w-4" />
              </span>
            </div>
            <p className={`mt-1 text-2xl font-bold ${temItens ? c.ativo.numero : 'text-slate-300'}`}>{c.valor}</p>
            <p className="text-xs text-slate-400 truncate">{c.ajuda}</p>
          </>
        );

        if (hrefBase) {
          return (
            <Link key={c.id} href={`${hrefBase}?situacao=${c.id}`} className={classe}>
              {conteudo}
            </Link>
          );
        }
        if (onSelecionar) {
          return (
            <button key={c.id} type="button" aria-pressed={marcado} onClick={() => onSelecionar(marcado ? null : c.id)} className={classe}>
              {conteudo}
            </button>
          );
        }
        return (
          <div key={c.id} className={classe}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}
