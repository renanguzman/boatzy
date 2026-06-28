'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Send, User, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { enviarMensagem, marcarConversaComoLida } from '@/lib/chat-actions';

export type Mensagem = {
  id: string;
  remetente_id: string;
  conteudo: string;
  lida_em: string | null;
  created_at: string;
};

type Interlocutor = { name: string; email: string; avatar_url: string | null };

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDiaSeparador(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, hoje)) return 'Hoje';
  if (sameDay(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ChatBox({
  conversaId,
  meId,
  interlocutor,
  voltarHref,
  voltarLabel = 'Voltar',
  mensagensIniciais,
}: {
  conversaId: string;
  meId: string;
  interlocutor: Interlocutor;
  voltarHref: string;
  voltarLabel?: string;
  mensagensIniciais: Mensagem[];
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais);
  const [texto, setTexto] = useState('');
  const [enviando, startEnvio] = useTransition();

  const supabaseRef = useRef(createClient());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Realtime: novas mensagens desta conversa.
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`conversa:${conversaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagem',
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const nova = payload.new as Mensagem;
          setMensagens((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]));
          // Mensagem recebida da outra parte → marca como lida.
          if (nova.remetente_id !== meId) {
            void marcarConversaComoLida(conversaId);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversaId, meId]);

  const handleEnviar = useCallback(() => {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    startEnvio(async () => {
      const res = await enviarMensagem(conversaId, conteudo);
      if (res.ok) setTexto('');
    });
  }, [texto, enviando, conversaId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#F8F9FB]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-slate-200">
        <Link
          href={voltarHref}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0B2447] hover:bg-slate-100 transition-colors"
          title={voltarLabel}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
          {interlocutor.avatar_url ? (
            <Image
              src={interlocutor.avatar_url}
              alt={interlocutor.name}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0B2447] leading-tight truncate">{interlocutor.name}</p>
          <p className="text-xs text-slate-400 truncate">{interlocutor.email}</p>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-1">
        {mensagens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-500">Nenhuma mensagem ainda</p>
            <p className="text-xs text-slate-400 mt-1">Envie a primeira mensagem para iniciar a conversa.</p>
          </div>
        ) : (
          mensagens.map((m, i) => {
            const mine = m.remetente_id === meId;
            const prev = mensagens[i - 1];
            const showSeparador =
              !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
            return (
              <div key={m.id}>
                {showSeparador && (
                  <div className="flex justify-center my-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 rounded-full px-3 py-1">
                      {formatDiaSeparador(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                      mine
                        ? 'bg-[#0B2447] text-white rounded-br-md'
                        : 'bg-white text-slate-700 border border-slate-100 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{m.conteudo}</p>
                    <p className={`text-[10px] mt-1 text-right ${mine ? 'text-white/60' : 'text-slate-400'}`}>
                      {formatHora(m.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 bg-white border-t border-slate-200">
        <div className="flex items-end gap-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Escreva uma mensagem..."
            className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
          />
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || !texto.trim()}
            title="Enviar"
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full bg-[#0B2447] hover:bg-[#0B3D91] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
