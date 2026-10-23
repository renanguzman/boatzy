'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ChevronRight, X } from 'lucide-react';
import NotificacaoItem from './NotificacaoItem';
import { useNotificacoes } from './useNotificacoes';
import { tituloNotificacao, visualNotificacao, type Notificacao } from '@/lib/notificacoes/apresentacao';

/**
 * Sino de notificações do cliente no header do site: contador de não lidas,
 * lista das mais recentes, "Marcar todas como lidas" e aviso flutuante
 * (toast) quando chega uma notificação nova em tempo real.
 */
export default function SinoNotificacoes({ userId }: { userId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Notificacao | null>(null);

  const onNova = useCallback((n: Notificacao) => setToast(n), []);
  const { itens, naoLidas, carregando, marcarLida, marcarTodasLidas } = useNotificacoes(userId, { limite: 12, onNova });

  // Toast some sozinho.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function abrir(n: Notificacao) {
    setOpen(false);
    setToast(null);
    if (!n.lida_em) void marcarLida(n.id);
  }

  const ToastIcone = toast ? visualNotificacao(toast.tipo).icone : Bell;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setToast(null); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lida${naoLidas !== 1 ? 's' : ''}` : 'Notificações'}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          open ? 'bg-slate-100 text-[#0B2447]' : 'text-slate-500 hover:bg-slate-50 hover:text-[#0B2447]'
        }`}
      >
        <Bell className={`h-5 w-5 ${toast ? 'animate-sino' : ''}`} />
        {naoLidas > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-3 top-[4.25rem] sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[24rem] rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10 overflow-hidden z-50"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-[#0B2447]">Notificações</p>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={() => void marcarTodasLidas()}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-[#0B3D91] transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {carregando ? (
            <div className="space-y-3 px-4 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-9 w-9 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                    <div className="h-3 w-5/6 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : itens.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">Nenhuma notificação por aqui</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Avisos das suas reservas, pagamentos e mensagens aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="max-h-[60dvh] sm:max-h-[26rem] overflow-y-auto overscroll-contain divide-y divide-slate-50">
              {itens.map((n) => (
                <NotificacaoItem key={n.id} n={n} onAbrir={abrir} compacto />
              ))}
            </div>
          )}

          <Link
            href="/notificacoes"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 px-4 py-3 border-t border-slate-100 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] hover:bg-slate-50 transition-colors"
          >
            Ver todas as notificações
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Aviso em tempo real */}
      {toast && !open && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-3 top-[4.75rem] z-[60] w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-slate-100 bg-white p-3 shadow-xl shadow-slate-900/15 animate-aviso"
        >
          <div className="flex items-start gap-3">
            <Link
              href={toast.link ?? '/notificacoes'}
              onClick={() => abrir(toast)}
              className="flex min-w-0 flex-1 items-start gap-3"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visualNotificacao(toast.tipo).cor}`}>
                <ToastIcone className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0B2447]">{tituloNotificacao(toast)}</span>
                <span className="mt-0.5 block text-xs text-slate-500 line-clamp-2">{toast.mensagem}</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fechar aviso"
              className="rounded-lg p-1 text-slate-300 hover:bg-slate-50 hover:text-slate-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
