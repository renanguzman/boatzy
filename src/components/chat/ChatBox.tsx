'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ExternalLink, Send, User, Loader2, Tag, ShieldAlert, Sparkles, X, type LucideIcon } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import { enviarMensagem, marcarConversaComoLida, confirmarAvisoChat } from '@/lib/chat-actions';
import type { ConversaOrigem } from '@/lib/conversa-origem';
import { dataISONoFuso } from '@/lib/datas';
import { useFormatos } from '@/i18n/formatos';

export type Mensagem = {
  id: string;
  remetente_id: string;
  conteudo: string;
  lida_em: string | null;
  created_at: string;
};

type Interlocutor = {
  name: string;
  /** Lado do gestor (painel): e-mail do cliente. */
  email?: string;
  /**
   * Lado do cliente (site): quem é a outra parte, no lugar do e-mail — o contato direto do
   * dono/vendedor não é exibido, para a conversa ficar no Boatzy.
   */
  descricao?: string;
  avatar_url: string | null;
};

/** Assunto sugerido: um clique preenche o campo com `texto` (a pessoa revisa e envia). */
export type SugestaoChat = { rotulo: string; texto: string; icone?: LucideIcon };


export default function ChatBox({
  conversaId,
  meId,
  interlocutor,
  voltarHref,
  voltarLabel,
  mensagensIniciais,
  rascunhoInicial,
  contexto,
  avisoCienteInicial,
  onFechar,
  abrirEmNovaAbaHref,
  sugestoes,
  saudacao,
  rascunhoExterno,
}: {
  conversaId: string;
  meId: string;
  interlocutor: Interlocutor;
  /** Link do "voltar" no modo página (ignorado com `onFechar`). */
  voltarHref?: string;
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
  /** Modo modal: o cabeçalho mostra "fechar" no lugar do "voltar". */
  onFechar?: () => void;
  /** Modo modal: atalho para abrir a mesma conversa em uma nova aba. */
  abrirEmNovaAbaHref?: string;
  /**
   * Assuntos sugeridos: na conversa vazia, cartões no centro; depois, chips acima do campo
   * (enquanto ele está vazio). Um clique preenche o campo — nada é enviado sozinho.
   */
  sugestoes?: SugestaoChat[];
  /** Abertura colocada antes do assunto escolhido quando ainda não há mensagens. */
  saudacao?: string;
  /**
   * Rascunho vindo de fora depois de montado (modal reaberta com um texto novo): substitui o
   * campo sempre que `versao` muda.
   */
  rascunhoExterno?: { texto: string; versao: number };
}) {
  const t = useTranslations('Chat.caixa');
  const tChat = useTranslations('Chat');
  const tComum = useTranslations('Comum');
  const f = useFormatos();
  const origemTipoLabel = (tipo: string) =>
    tipo === 'venda' || tipo === 'roteiro' || tipo === 'embarcacao' ? t(`origem.${tipo}`) : tipo;
  const formatDiaSeparador = (iso: string) => {
    const dia = dataISONoFuso(new Date(iso));
    if (dia === dataISONoFuso(new Date())) return t('hoje');
    if (dia === dataISONoFuso(new Date(Date.now() - 86_400_000))) return t('ontem');
    return f.data(iso, { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const emModal = !!onFechar;
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais);
  const [texto, setTexto] = useState(rascunhoInicial ?? '');
  const [enviando, startEnvio] = useTransition();
  const [avisoPendente, setAvisoPendente] = useState(avisoCienteInicial === false);
  const [confirmandoAviso, startConfirmarAviso] = useTransition();

  const supabaseRef = useRef(createClient());
  const bottomRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const versaoRascunho = rascunhoExterno?.versao;
  useEffect(() => {
    if (versaoRascunho == null || !rascunhoExterno?.texto) return;
    setTexto(rascunhoExterno.texto);
    // Só quando chega uma versão nova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoRascunho]);

  // Campo cresce com o texto (até o limite do max-h) — o assunto pré-preenchido aparece inteiro.
  useEffect(() => {
    const el = campoRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [texto]);

  function escolherSugestao(sugestao: SugestaoChat) {
    setTexto(mensagens.length === 0 && saudacao ? `${saudacao}\n${sugestao.texto}` : sugestao.texto);
    // Foco no fim do texto: a pessoa só revisa e envia.
    requestAnimationFrame(() => {
      const el = campoRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

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
    <div className="relative flex flex-col h-full bg-[#F8F9FB]">
      {/* Header */}
      <div className={`flex items-center gap-3 bg-white border-b border-slate-200 ${emModal ? 'px-4 sm:px-5 py-3' : 'px-6 py-4'}`}>
        {!emModal && voltarHref && (
          <Link
            href={voltarHref}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-marinho hover:bg-slate-100 transition-colors"
            title={voltarLabel ?? tComum('voltar')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
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
          <p className="text-sm font-semibold text-marinho leading-tight truncate">{interlocutor.name}</p>
          <p className="text-xs text-slate-400 truncate">{interlocutor.descricao ?? interlocutor.email}</p>
        </div>
        {contexto && !emModal && (
          <span
            className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-marinho/10 px-3 py-1.5 text-xs font-medium text-marinho max-w-[45%]"
            title={t('referenteA', { label: contexto.label, tipo: origemTipoLabel(contexto.tipo) })}
          >
            <Tag className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {origemTipoLabel(contexto.tipo)}: {contexto.label}
            </span>
          </span>
        )}
        {emModal && (
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {abrirEmNovaAbaHref && (
              <a
                href={abrirEmNovaAbaHref}
                target="_blank"
                rel="noopener noreferrer"
                title={t('abrirNovaAba')}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-marinho hover:bg-slate-100 transition-colors"
              >
                <ExternalLink className="w-4.5 h-4.5" />
                <span className="sr-only">{t('abrirNovaAba')}</span>
              </a>
            )}
            <button
              type="button"
              onClick={onFechar}
              title={t('fecharVoltar')}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-marinho hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
              <span className="sr-only">{tComum('fechar')}</span>
            </button>
          </div>
        )}
      </div>
      {/* Selo de contexto no mobile (abaixo do header) */}
      {contexto && (
        <div className={`${emModal ? 'px-4 sm:px-5' : 'sm:hidden px-6'} flex items-center gap-1.5 py-2 bg-marinho/5 border-b border-slate-100 text-xs font-medium text-marinho`}>
          <Tag className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {origemTipoLabel(contexto.tipo)}: {contexto.label}
          </span>
        </div>
      )}

      {/* Mensagens */}
      <div className={`flex-1 overflow-y-auto space-y-1 ${emModal ? 'px-4 sm:px-5 py-5' : 'px-6 py-6'}`}>
        {mensagens.length === 0 && sugestoes && sugestoes.length > 0 ? (
          // Conversa vazia: assuntos para começar com um clique.
          <div className="min-h-full flex flex-col justify-center">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-marinho">
              <Sparkles className="h-4 w-4 text-turquesa-escuro" />
              {t('sobreOQue')}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t('toqueAssunto')}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {sugestoes.map((sug) => {
                const Icone = sug.icone;
                const escolhida = texto.endsWith(sug.texto);
                return (
                  <button
                    key={sug.rotulo}
                    type="button"
                    onClick={() => escolherSugestao(sug)}
                    disabled={avisoPendente}
                    aria-pressed={escolhida}
                    className={`group flex items-center sm:items-start gap-2.5 sm:gap-3 rounded-xl border p-2.5 sm:p-3 text-left transition-colors disabled:opacity-50 ${
                      escolhida
                        ? 'border-marinho bg-marinho/[0.04]'
                        : 'border-slate-200 bg-white hover:border-marinho/40 hover:bg-marinho/[0.02]'
                    }`}
                  >
                    {Icone && (
                      <span className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${escolhida ? 'bg-marinho text-white' : 'bg-marinho/10 text-marinho'}`}>
                        <Icone className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[13px] sm:text-sm font-semibold leading-snug text-marinho">{sug.rotulo}</span>
                      {/* Celular: só o assunto (menos leitura); a mensagem completa aparece no campo ao tocar. */}
                      <span className="mt-0.5 hidden sm:block text-xs leading-snug text-slate-500 line-clamp-2">{sug.texto}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : mensagens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-500">{t('nenhumaMensagem')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('envieAPrimeira')}</p>
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
                        ? 'bg-marinho text-white rounded-br-md'
                        : 'bg-white text-slate-700 border border-slate-100 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{m.conteudo}</p>
                    <p className={`text-[10px] mt-1 text-right ${mine ? 'text-white/60' : 'text-slate-400'}`}>
                      {f.hora(m.created_at)}
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
      <div className={`bg-white border-t border-slate-200 ${emModal ? 'px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'px-6 py-4'}`}>
        {/* Com a conversa em andamento: assuntos em chips, enquanto o campo está vazio */}
        {sugestoes && sugestoes.length > 0 && mensagens.length > 0 && !texto.trim() && !avisoPendente && (
          <div className="-mx-4 sm:-mx-5 mb-2.5 flex gap-2 overflow-x-auto px-4 sm:px-5 pb-0.5 [scrollbar-width:none]">
            {sugestoes.map((sug) => {
              const Icone = sug.icone;
              return (
                <button
                  key={sug.rotulo}
                  type="button"
                  onClick={() => escolherSugestao(sug)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-marinho hover:border-marinho/40 hover:bg-marinho/[0.03] transition-colors"
                >
                  {Icone && <Icone className="h-3.5 w-3.5 text-turquesa-escuro" />}
                  {sug.rotulo}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-end gap-3">
          <textarea
            ref={campoRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={avisoPendente}
            placeholder={t('placeholder')}
            className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho/40 transition disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || !texto.trim() || avisoPendente}
            title={t('enviar')}
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full bg-marinho hover:bg-marinho-escuro text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Aviso "converse pela plataforma" — bloqueante, só lado cliente (site). */}
      {avisoPendente && (
        <div className={`${emModal ? 'absolute' : 'fixed'} inset-0 z-50 flex items-center justify-center p-4`}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg max-h-full overflow-y-auto p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-marinho/10 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-marinho" />
              </div>
              <h3 className="text-base font-bold text-marinho mt-1.5">
                {tChat('aviso.titulo')}
              </h3>
            </div>

            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>{tChat('aviso.p1')}</p>
              <p>{tChat('aviso.p2')}</p>
              <p className="text-xs text-slate-400">{tChat('aviso.p3')}</p>
            </div>

            <button
              type="button"
              onClick={handleConfirmarAviso}
              disabled={confirmandoAviso}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-marinho hover:bg-marinho-escuro text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {confirmandoAviso && <Loader2 className="w-4 h-4 animate-spin" />}
              {tChat('aviso.ciente')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
