'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bell, CheckCheck, MessageCircle, ChevronRight, X } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import { FUSO_HORARIO } from '@/lib/datas';
import NotificacaoItem from '@/components/notificacoes/NotificacaoItem';
import { useNotificacoes } from '@/components/notificacoes/useNotificacoes';
import { tituloNotificacao, visualNotificacao, type Notificacao } from '@/lib/notificacoes/apresentacao';

/**
 * Disparado na janela quando chega um aviso novo ao gestor (reserva/pagamento):
 * a Sidebar recalcula o badge de pendentes e o dashboard se atualiza (SPEC §87).
 */
export const EVENTO_AVISO_GESTOR = 'boatzy:aviso-gestor';

type ConversaNaoLida = {
  conversa_id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_avatar: string | null;
  total: number;
  ultima_mensagem: string;
  ultima_em: string;
};

function formatQuando(iso: string): string {
  const data = new Date(iso);
  const diffMin = Math.floor((Date.now() - data.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  return data.toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit' });
}

/**
 * Sino de notificações do painel. Junta os avisos do gestor (tabela
 * `notificacao`, público 'gestor': nova solicitação, cancelamento, prazo
 * expirado, pagamento aprovado/recusado, reembolso) e as mensagens de chat não
 * lidas dos clientes (RPC chat_conversas_nao_lidas) — os dois ao vivo via
 * Realtime. Aviso novo mostra um toast e dispara `EVENTO_AVISO_GESTOR`.
 */
export default function NotificacoesBell({ userId }: { userId: string | null }) {
  const supabaseRef = useRef(createClient());
  const containerRef = useRef<HTMLDivElement>(null);
  const [conversas, setConversas] = useState<ConversaNaoLida[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Notificacao | null>(null);

  const onNova = useCallback((n: Notificacao) => {
    setToast(n);
    window.dispatchEvent(new Event(EVENTO_AVISO_GESTOR));
  }, []);
  const { itens, naoLidas, carregando, marcarLida, marcarTodasLidas } = useNotificacoes(userId, {
    publico: 'gestor',
    limite: 12,
    onNova,
  });

  useEffect(() => {
    const supabase = supabaseRef.current;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    async function refetch() {
      const { data } = await supabase.rpc('chat_conversas_nao_lidas');
      if (!cancelled) setConversas((data ?? []) as ConversaNaoLida[]);
    }

    (async () => {
      await authorizeRealtime(supabase);
      if (cancelled) return;
      await refetch();
      // Qualquer mudança em `mensagem` que a RLS entregue (conversas deste
      // gestor) dispara um refetch — mesmo padrão da Sidebar.
      channel = supabase
        .channel('bell:nao-lidas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagem' }, () => {
          void refetch();
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  // Toast some sozinho.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
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

  const totalMensagens = conversas.reduce((acc, c) => acc + Number(c.total), 0);
  const totalGeral = naoLidas + totalMensagens;
  const vazio = itens.length === 0 && conversas.length === 0;
  const ToastIcone = toast ? visualNotificacao(toast.tipo).icone : Bell;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setToast(null); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={totalGeral > 0 ? `Notificações: ${totalGeral} não lida${totalGeral !== 1 ? 's' : ''}` : 'Notificações'}
        className="relative p-2.5 sm:p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]"
      >
        <Bell className={`w-5 h-5 ${toast ? 'animate-sino' : ''}`} />
        {totalGeral > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white">
            {totalGeral > 99 ? '99+' : totalGeral}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-3 top-[3.75rem] sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[26rem] rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10 overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#0B2447]">Notificações</p>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={() => void marcarTodasLidas()}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-[#0B2447] transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar avisos como lidos
              </button>
            )}
          </div>

          {carregando && conversas.length === 0 ? (
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
          ) : vazio ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">Nenhuma notificação por aqui</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Solicitações de reserva, pagamentos, mensagens e vencimento de documentos aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="max-h-[65dvh] sm:max-h-[28rem] overflow-y-auto overscroll-contain">
              {itens.length > 0 && (
                <section>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Reservas, pagamentos e documentos
                  </p>
                  <div className="divide-y divide-slate-50">
                    {itens.map((n) => (
                      <NotificacaoItem key={n.id} n={n} onAbrir={abrir} compacto />
                    ))}
                  </div>
                </section>
              )}
              {conversas.length > 0 && (
                <section className={itens.length > 0 ? 'border-t border-slate-100' : ''}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mensagens</p>
                  {conversas.map((c) => (
                    <Link
                      key={c.conversa_id}
                      href={`/painel/clientes/${c.cliente_id}/chat`}
                      onClick={() => setOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                        {c.cliente_avatar ? (
                          <Image src={c.cliente_avatar} alt={c.cliente_nome} fill className="object-cover" sizes="36px" />
                        ) : (
                          <span className="text-sm font-bold text-slate-400">{c.cliente_nome.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#0B2447] truncate">{c.cliente_nome}</p>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatQuando(c.ultima_em)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MessageCircle className="h-3 w-3 text-slate-400 shrink-0" />
                          <p className="text-xs text-slate-500 truncate">{c.ultima_mensagem}</p>
                        </div>
                      </div>
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {Number(c.total) > 99 ? '99+' : c.total}
                      </span>
                    </Link>
                  ))}
                </section>
              )}

            </div>
          )}

          <div className="grid grid-cols-2 border-t border-slate-100 divide-x divide-slate-100">
            <Link
              href="/painel/agendamentos"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 px-4 py-3 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] hover:bg-slate-50 transition-colors"
            >
              Ver agendamentos
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/painel/clientes"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 px-4 py-3 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] hover:bg-slate-50 transition-colors"
            >
              Ver clientes
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Aviso em tempo real */}
      {toast && !open && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-3 top-[4.25rem] lg:top-[4.75rem] z-[60] w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-slate-100 bg-white p-3 shadow-xl shadow-slate-900/15 animate-aviso"
        >
          <div className="flex items-start gap-3">
            <Link
              href={toast.link ?? '/painel/agendamentos'}
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
