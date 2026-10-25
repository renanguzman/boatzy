'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useModoPreview } from '@/components/preview/ModoPreview';
import { ChatDonoDialog, saudacaoPasseio } from '@/components/chat/ChatDonoModal';
import { formatarData } from '@/lib/datas';

/** Mesmo teto do envio no chat (`enviarMensagem`, src/lib/chat-actions.ts). */
const MAX_MENSAGEM = 4000;

type Props = {
  roteiroId: string;
  roteiroNome: string;
  /** Data e pessoas escolhidas no card de reserva — entram na abertura das mensagens sugeridas. */
  dataISO?: string | null;
  pessoas?: number;
};

/**
 * Contato com o dono no detalhe do roteiro: abre a conversa em modal (`ChatDonoDialog`), sem
 * sair da página. O que o cliente começou a escrever aqui vai como rascunho, para revisar e
 * enviar; sem texto, a modal sugere assuntos (com a data e as pessoas, se já escolhidas).
 * Deslogado, segue para o chat (`/roteiros/[id]/chat?mensagem=…`), que passa pelo login e volta
 * com o texto preservado.
 */
export default function ContatoDono({ roteiroId, roteiroNome, dataISO, pessoas }: Props) {
  const router = useRouter();
  const preview = useModoPreview();
  const idCampo = useId();
  const [texto, setTexto] = useState('');
  const [indo, setIndo] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<{ texto: string; versao: number } | undefined>();
  const botaoRef = useRef<HTMLButtonElement>(null);

  function abrirConversa() {
    if (preview.ativo) { preview.avisar(); return; }
    const mensagem = texto.trim();
    // Texto novo substitui o rascunho da modal (mesmo se ela já foi aberta antes).
    if (mensagem) setRascunho((r) => ({ texto: mensagem, versao: (r?.versao ?? 0) + 1 }));
    setAberto(true);
  }

  const fechar = useCallback(() => {
    setAberto(false);
    // O texto já foi para a conversa — o campo daqui fica livre.
    setTexto('');
    botaoRef.current?.focus();
  }, []);

  const irParaLogin = useCallback(() => {
    setAberto(false);
    setIndo(true);
    const mensagem = texto.trim();
    router.push(
      mensagem
        ? `/roteiros/${roteiroId}/chat?mensagem=${encodeURIComponent(mensagem)}`
        : `/roteiros/${roteiroId}/chat`,
    );
  }, [router, roteiroId, texto]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); abrirConversa(); }}
      className="rounded-2xl border border-slate-200 p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Ícone em tom do amarelo de destaque — conversa com o botão abaixo */}
        <span className="h-10 w-10 rounded-xl bg-destaque/25 flex items-center justify-center shrink-0">
          <MessageCircle className="h-5 w-5 text-marinho" />
        </span>
        <div className="min-w-0">
          <label htmlFor={idCampo} className="block text-sm font-semibold text-marinho leading-snug">
            Ficou com dúvida? Fale com o dono da embarcação
          </label>
          <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
            A conversa acontece aqui pelo Boatzy, antes de você reservar.
          </p>
        </div>
      </div>

      <textarea
        id={idCampo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/⌘ + Enter abre a conversa; Enter sozinho quebra a linha.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); abrirConversa(); }
        }}
        rows={2}
        maxLength={MAX_MENSAGEM}
        placeholder="Olá! Gostaria de saber se…"
        className="mt-4 block w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho/40 transition"
      />

      <button
        ref={botaoRef}
        type="submit"
        disabled={indo}
        aria-haspopup="dialog"
        // Amarelo de destaque da paleta (uso pontual): texto marinho, contraste 8,8:1.
        className="group mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destaque text-marinho shadow-sm shadow-destaque/40 hover:brightness-95 active:scale-[0.99] text-sm font-bold transition disabled:opacity-70"
      >
        Conversar com o dono
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>

      <ChatDonoDialog
        roteiroId={roteiroId}
        aberto={aberto}
        onFechar={fechar}
        origem="roteiro"
        rascunho={rascunho}
        onSemSessao={irParaLogin}
        saudacao={saudacaoPasseio(roteiroNome, { dataLabel: dataISO ? formatarData(dataISO) : null, pessoas })}
      />
    </form>
  );
}
