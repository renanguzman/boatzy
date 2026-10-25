'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Baby, CloudRain, ExternalLink, Loader2, MapPin, MessageCircle, PackageCheck, Route, UtensilsCrossed, X } from 'lucide-react';
import ChatBox, { type SugestaoChat } from './ChatBox';
import { abrirChatRoteiro } from '@/app/roteiros/[id]/chat/actions';
import type { ChatRoteiroDados } from '@/lib/chat-roteiro';
import { rastrearUmaVez } from '@/lib/analytics';

/** Dúvidas mais comuns antes de reservar um passeio — um clique vira a mensagem. */
const SUGESTOES: SugestaoChat[] = [
  { rotulo: 'Ponto de embarque', icone: MapPin, texto: 'Onde fica o ponto de embarque e com quanto tempo de antecedência devo chegar?' },
  { rotulo: 'O que está incluso', icone: PackageCheck, texto: 'O que está incluso no passeio e o que eu preciso levar?' },
  { rotulo: 'Comida e bebida', icone: UtensilsCrossed, texto: 'Posso levar comida e bebida a bordo? Tem cooler ou gelo disponível?' },
  { rotulo: 'Crianças a bordo', icone: Baby, texto: 'Vou com crianças. Tem colete salva-vidas infantil a bordo?' },
  { rotulo: 'Se o tempo virar', icone: CloudRain, texto: 'Se o tempo estiver ruim no dia, como funciona? Dá para remarcar?' },
  { rotulo: 'Ajustar o roteiro', icone: Route, texto: 'É possível ajustar o roteiro ou incluir alguma parada?' },
];

type Estado =
  | { status: 'fechado' }
  | { status: 'carregando' }
  | { status: 'ok'; dados: ChatRoteiroDados }
  | { status: 'erro'; mensagem: string };

/**
 * Abertura das mensagens sugeridas, com o que o cliente já escolheu: "Olá! Tenho interesse no
 * passeio "X" para 07/11/2026, com 4 pessoas." (sem data, só o passeio).
 */
export function saudacaoPasseio(
  roteiroNome: string,
  { verbo = 'Tenho interesse no', dataLabel, pessoas }: { verbo?: string; dataLabel?: string | null; pessoas?: number } = {},
): string {
  const quando = dataLabel ? ` para ${dataLabel}` : '';
  const quem = dataLabel && pessoas ? `, com ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}` : '';
  return `Olá! ${verbo} passeio "${roteiroNome}"${quando}${quem}.`;
}

/**
 * Conversa com o dono do roteiro em modal, por cima da página — o cliente não perde o que
 * estava vendo. Controlada por quem usa (`aberto`/`onFechar`). Abre com assuntos sugeridos
 * (um clique preenche a mensagem com `saudacao` + a pergunta) e tem atalho para abrir a
 * conversa em uma nova aba. Carrega na primeira abertura e continua montada depois de
 * fechada: rascunho e mensagens ficam onde estavam ao reabrir. `rascunho` (com `versao`)
 * substitui o campo ao reabrir com um texto novo. Deslogado → `onSemSessao`.
 * Renderizada no `body` (portal): quem abre pode estar dentro de uma coluna `sticky`, que
 * prenderia a modal no próprio contexto de empilhamento (atrás do header).
 */
export function ChatDonoDialog({
  roteiroId,
  aberto,
  onFechar,
  saudacao,
  rascunho,
  origem,
  onSemSessao,
}: {
  roteiroId: string;
  aberto: boolean;
  onFechar: () => void;
  saudacao: string;
  rascunho?: { texto: string; versao: number };
  /** De onde a conversa foi aberta (GA4 `iniciar_conversa`). */
  origem: 'reserva' | 'roteiro';
  onSemSessao?: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ status: 'fechado' });
  const painelRef = useRef<HTMLDivElement>(null);
  const hrefNovaAba = `/roteiros/${roteiroId}/chat`;

  const carregar = useCallback(async () => {
    setEstado({ status: 'carregando' });
    const r = await abrirChatRoteiro(roteiroId);
    if (r.ok) {
      setEstado({ status: 'ok', dados: r.dados });
      // GA4: contato com o dono (1x por item e navegador) — mesma chave da página de chat (SPEC §65).
      rastrearUmaVez(`iniciar_conversa:roteiro:${roteiroId}`, 'iniciar_conversa', { origem, item_id: roteiroId });
    } else if (r.semSessao && onSemSessao) {
      setEstado({ status: 'fechado' });
      onSemSessao();
    } else {
      setEstado({ status: 'erro', mensagem: r.error });
    }
  }, [roteiroId, origem, onSemSessao]);

  // Carrega na primeira abertura (e de novo se a anterior falhou).
  const status = estado.status;
  useEffect(() => {
    if (aberto && (status === 'fechado' || status === 'erro')) void carregar();
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Esc fecha; a página por trás não rola enquanto a conversa está aberta.
  useEffect(() => {
    if (!aberto) return;
    painelRef.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', onKey);
    };
  }, [aberto, onFechar]);

  if (estado.status === 'fechado') return null;

  return createPortal(
    <div className={aberto ? 'fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4' : 'hidden'}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onClick={onFechar} aria-hidden />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Conversa com o dono da embarcação"
        tabIndex={-1}
        className="relative w-full h-[100dvh] sm:h-[min(44rem,90dvh)] sm:max-w-xl bg-white sm:rounded-2xl overflow-hidden shadow-2xl outline-none animate-fade-in"
      >
        {estado.status === 'ok' ? (
          <ChatBox
            conversaId={estado.dados.conversaId}
            meId={estado.dados.meId}
            interlocutor={estado.dados.interlocutor}
            mensagensIniciais={estado.dados.mensagens}
            rascunhoInicial={rascunho?.texto}
            rascunhoExterno={rascunho}
            contexto={{ tipo: 'roteiro', label: estado.dados.roteiroNome }}
            avisoCienteInicial={estado.dados.avisoCiente}
            onFechar={onFechar}
            abrirEmNovaAbaHref={hrefNovaAba}
            sugestoes={SUGESTOES}
            saudacao={saudacao}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 sm:px-5 py-3">
              <p className="text-sm font-semibold text-marinho">Conversa com o dono</p>
              <button
                type="button"
                onClick={onFechar}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-marinho hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
                <span className="sr-only">Fechar conversa</span>
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              {estado.status === 'carregando' ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-marinho" />
                  <p className="text-sm text-slate-500">Abrindo a conversa…</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">{estado.mensagem}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void carregar()}
                      className="rounded-xl bg-marinho px-4 py-2 text-sm font-semibold text-white hover:bg-marinho-escuro"
                    >
                      Tentar de novo
                    </button>
                    <a
                      href={hrefNovaAba}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-marinho hover:bg-slate-50"
                    >
                      Abrir em nova aba <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Botão "Converse com o dono da embarcação deste Roteiro" da confirmação da reserva: abre a
 * conversa em modal (`ChatDonoDialog`), com a data e as pessoas já na abertura das sugestões.
 */
export default function ChatDonoModal({
  roteiroId,
  roteiroNome,
  dataLabel,
  pessoas,
}: {
  roteiroId: string;
  roteiroNome: string;
  /** Data do passeio já formatada (ex.: 07/11/2026). */
  dataLabel: string;
  pessoas: number;
}) {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    botaoRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="mt-4 w-full flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl bg-marinho hover:bg-marinho-escuro text-white transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4" />
          Converse com o dono da embarcação deste Roteiro
        </span>
        <span className="text-xs text-white/70">Tire dúvidas sem sair desta página</span>
      </button>

      <ChatDonoDialog
        roteiroId={roteiroId}
        aberto={aberto}
        onFechar={fechar}
        origem="reserva"
        saudacao={saudacaoPasseio(roteiroNome, { verbo: 'Estou solicitando o', dataLabel, pessoas })}
      />
    </>
  );
}
