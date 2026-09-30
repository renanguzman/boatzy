'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Mail, CalendarClock, TimerOff, StickyNote, Loader2, X, TriangleAlert } from 'lucide-react';
import type { PedidoStatus } from '@/types/supabase';
import { anotarPedido, expirarPedidoAgora, prorrogarPrazo, reenviarEmail, sincronizarPedido } from '../../actions';

type Modal = 'prorrogar' | 'expirar' | 'anotar' | null;
type Mensagem = { ok: boolean; texto: string } | null;

const botaoCls =
  'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/** Barra de ações do admin sobre o pedido. Toda ação fica registrada na auditoria. */
export default function PedidoAcoes({ pedidoId, status }: { pedidoId: string; status: PedidoStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<Modal>(null);
  const [motivo, setMotivo] = useState('');
  const [horas, setHoras] = useState('24');
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const aguardando = status === 'aguardando_pagamento';
  const podeReenviar = aguardando || status === 'pago';

  function executar(acao: () => Promise<{ ok: true; mensagem?: string } | { ok: false; error: string }>) {
    setMensagem(null);
    startTransition(async () => {
      const r = await acao();
      setMensagem(r.ok ? { ok: true, texto: r.mensagem ?? 'Feito.' } : { ok: false, texto: r.error });
      if (r.ok) {
        setModal(null);
        setMotivo('');
      }
      router.refresh();
    });
  }

  function confirmarModal() {
    if (modal === 'prorrogar') executar(() => prorrogarPrazo(pedidoId, Number(horas), motivo));
    if (modal === 'expirar') executar(() => expirarPedidoAgora(pedidoId, motivo));
    if (modal === 'anotar') executar(() => anotarPedido(pedidoId, motivo));
  }

  const tituloModal = {
    prorrogar: 'Prorrogar prazo de pagamento',
    expirar: 'Expirar pedido agora',
    anotar: 'Anotação interna',
  } as const;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => executar(() => sincronizarPedido(pedidoId))}
          className={`${botaoCls} bg-[#0B2447] text-white hover:bg-[#0B3D91]`}>
          {pending && !modal ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar com o Asaas
        </button>
        <button type="button" disabled={pending || !podeReenviar} onClick={() => executar(() => reenviarEmail(pedidoId))}
          title={podeReenviar ? undefined : 'Só para pedidos aguardando pagamento ou pagos'}
          className={`${botaoCls} bg-slate-100 text-[#0B2447] hover:bg-slate-200`}>
          <Mail className="w-4 h-4" /> Reenviar e-mail
        </button>
        {aguardando && (
          <>
            <button type="button" disabled={pending} onClick={() => { setModal('prorrogar'); setMensagem(null); }}
              className={`${botaoCls} bg-slate-100 text-[#0B2447] hover:bg-slate-200`}>
              <CalendarClock className="w-4 h-4" /> Prorrogar prazo
            </button>
            <button type="button" disabled={pending} onClick={() => { setModal('expirar'); setMensagem(null); }}
              className={`${botaoCls} bg-red-50 text-red-700 hover:bg-red-100`}>
              <TimerOff className="w-4 h-4" /> Expirar agora
            </button>
          </>
        )}
        <button type="button" disabled={pending} onClick={() => { setModal('anotar'); setMensagem(null); }}
          className={`${botaoCls} bg-amber-50 text-amber-800 hover:bg-amber-100`}>
          <StickyNote className="w-4 h-4" /> Anotação
        </button>
      </div>

      {mensagem && (
        <p className={`mt-3 text-sm rounded-xl px-4 py-2.5 border ${mensagem.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'}`}>
          {mensagem.texto}
        </p>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => pending || setModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-base font-bold text-[#0B2447]">{tituloModal[modal]}</h3>
              <button type="button" onClick={() => setModal(null)} disabled={pending} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modal === 'expirar' && (
              <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-4">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                As cobranças pendentes são removidas no Asaas, o pedido expira, a data da reserva é liberada e o cliente
                recebe o e-mail de prazo expirado. Não dá para desfazer.
              </p>
            )}
            {modal === 'prorrogar' && (
              <label className="block mb-4">
                <span className="text-xs font-semibold text-slate-600">Estender por (horas)</span>
                <input type="number" min={1} max={168} value={horas} onChange={(e) => setHoras(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20" />
                <span className="block mt-1 text-[11px] text-slate-400">
                  Soma ao prazo atual (ou a agora, se já venceu), sem passar do fim do dia do passeio. Considere reenviar o e-mail depois.
                </span>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">{modal === 'anotar' ? 'Anotação' : 'Motivo (fica na auditoria)'}</span>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={2000}
                placeholder={modal === 'anotar' ? 'Ex.: cliente pediu para pagar amanhã, combinado por telefone…' : 'Ex.: cliente desistiu pelo chat…'}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20" />
            </label>

            {mensagem && !mensagem.ok && <p className="mt-3 text-sm text-red-600">{mensagem.texto}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setModal(null)} disabled={pending}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100">
                Voltar
              </button>
              <button type="button" onClick={confirmarModal} disabled={pending}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${modal === 'expirar' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0B2447] hover:bg-[#0B3D91]'}`}>
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                {modal === 'expirar' ? 'Expirar pedido' : modal === 'prorrogar' ? 'Prorrogar' : 'Salvar anotação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
