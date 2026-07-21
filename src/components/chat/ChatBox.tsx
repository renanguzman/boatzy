'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Send, User, Loader2, Tag, ShieldAlert } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import { enviarMensagem, marcarConversaComoLida, confirmarAvisoChat } from '@/lib/chat-actions';
import { origemTipoLabel, type ConversaOrigem } from '@/lib/conversa-origem';

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
  rascunhoInicial,
  contexto,
  avisoCienteInicial,
}: {
  conversaId: string;
  meId: string;
  interlocutor: Interlocutor;
  voltarHref: string;
  voltarLabel?: string;
  mensagensIniciais: Mensagem[];
  /** Texto pré-preenchido no campo de envio (ex.: contexto do anúncio de venda). */
  rascunhoInicial?: string;
  /** A que objeto a conversa se refere (venda/roteiro/embarcação). */
  contexto?: ConversaOrigem;
  /**
   * Lado cliente (site) apenas: se `false`, exibe o modal bloqueante "Estou
   * ciente" até a confirmação. `undefined` (lado do gestor/painel) nunca
   * exibe o modal.
   */
  avisoCienteInicial?: boolean;
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais);
  const [texto, setTexto] = useState(rascunhoInicial ?? '');
  const [enviando, startEnvio] = useTransition();
  const [avisoPendente, setAvisoPendente] = useState(avisoCienteInicial === false);
  const [confirmandoAviso, startConfirmarAviso] = useTransition();

  const supabaseRef = useRef(createClient());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Realtime: novas mensagens desta conversa.
  useEffect(() => {
    const supabase = supabaseRef.current;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    (async () => {
      await authorizeRealtime(supabase);
      if (cancelled) return;
      channel = supabase
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
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversaId, meId]);

  const handleEnviar = useCallback(() => {
    const conteudo = texto.trim();
    if (!conteudo || enviando || avisoPendente) return;
    startEnvio(async () => {
      const res = await enviarMensagem(conversaId, conteudo);
      if (res.ok) setTexto('');
    });
  }, [texto, enviando, avisoPendente, conversaId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  }

  function handleConfirmarAviso() {
    startConfirmarAviso(async () => {
      // Dispensa o modal mesmo se a persistência falhar (ex.: instabilidade
      // pontual) — o aviso já foi lido; travar o chat inteiro por causa
      // disso seria pior do que reexibir o aviso numa próxima conversa.
      await confirmarAvisoChat();
      setAvisoPendente(false);
    });
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
        {contexto && (
          <span
            className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#0B3D91]/10 px-3 py-1.5 text-xs font-medium text-[#0B3D91] max-w-[45%]"
            title={`Referente a: ${contexto.label} (${origemTipoLabel(contexto.tipo)})`}
          >
            <Tag className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {origemTipoLabel(contexto.tipo)}: {contexto.label}
            </span>
          </span>
        )}
      </div>
      {/* Selo de contexto no mobile (abaixo do header) */}
      {contexto && (
        <div className="sm:hidden flex items-center gap-1.5 px-6 py-2 bg-[#0B3D91]/5 border-b border-slate-100 text-xs font-medium text-[#0B3D91]">
          <Tag className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {origemTipoLabel(contexto.tipo)}: {contexto.label}
          </span>
        </div>
      )}

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
            disabled={avisoPendente}
            placeholder="Escreva uma mensagem..."
            className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || !texto.trim() || avisoPendente}
            title="Enviar"
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full bg-[#0B2447] hover:bg-[#0B3D91] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Aviso "converse pela plataforma" — bloqueante, só lado cliente (site). */}
      {avisoPendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-[#0B3D91]" />
              </div>
              <h3 className="text-base font-bold text-[#0B2447] mt-1.5">
                Comunicação exclusiva pela plataforma
              </h3>
            </div>

            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                Como plataforma de intermediação, a Boatzy recomenda que toda a comunicação
                relacionada a este atendimento — dúvidas, combinações de valores, alterações e
                demais tratativas — seja realizada exclusivamente por meio desta conversa, dentro
                do site. É esse canal que nos permite oferecer o suporte previsto nos Termos de
                Uso e na Política de Privacidade da plataforma, inclusive em caso de dúvidas ou
                eventuais divergências entre as partes.
              </p>
              <p>
                A Boatzy não se responsabiliza, em nenhuma hipótese, por tratativas, acordos,
                pagamentos, danos ou prejuízos decorrentes de comunicações realizadas por outros
                meios (como WhatsApp, telefone, e-mail ou redes sociais) que não tenham sido
                formalizadas dentro da plataforma. Fora deste canal, a Boatzy não tem meios de
                mediar a negociação nem de garantir o cumprimento do que for combinado entre as
                partes.
              </p>
              <p className="text-xs text-slate-400">
                Ao clicar em &quot;Estou ciente&quot;, você declara estar de acordo com esta
                orientação.
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirmarAviso}
              disabled={confirmandoAviso}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#092E6E] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {confirmandoAviso && <Loader2 className="w-4 h-4 animate-spin" />}
              Estou ciente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
