'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bell, MessageCircle, ChevronRight } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';

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
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Sino de notificações do painel. Hoje agrega as mensagens de chat não lidas
 * enviadas pelos clientes (RPC chat_conversas_nao_lidas, atualizada ao vivo
 * via Realtime); no futuro receberá outros tipos de notificação.
 */
export default function NotificacoesBell() {
  const supabaseRef = useRef(createClient());
  const containerRef = useRef<HTMLDivElement>(null);
  const [conversas, setConversas] = useState<ConversaNaoLida[]>([]);
  const [open, setOpen] = useState(false);

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

  const totalGeral = conversas.reduce((acc, c) => acc + Number(c.total), 0);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          totalGeral > 0
            ? `Notificações: ${totalGeral} mensagem(ns) não lida(s)`
            : 'Notificações'
        }
        className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]"
      >
        <Bell className="w-5 h-5" />
        {totalGeral > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white">
            {totalGeral > 99 ? '99+' : totalGeral}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10 overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-[#0B2447]">Notificações</p>
            {totalGeral > 0 && (
              <span className="text-xs font-semibold text-slate-400">
                {totalGeral} não lida{totalGeral !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {conversas.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">Nenhuma notificação nova</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Mensagens não lidas dos seus clientes aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1.5">
              {conversas.map((c) => (
                <Link
                  key={c.conversa_id}
                  href={`/painel/clientes/${c.cliente_id}/chat`}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                    {c.cliente_avatar ? (
                      <Image
                        src={c.cliente_avatar}
                        alt={c.cliente_nome}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">
                        {c.cliente_nome.charAt(0).toUpperCase()}
                      </span>
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
            </div>
          )}

          <Link
            href="/painel/clientes"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 px-4 py-3 border-t border-slate-100 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] hover:bg-slate-50 transition-colors"
          >
            Ver todos os clientes
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
