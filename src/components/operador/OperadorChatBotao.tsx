'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { ChatDonoDialog, saudacaoPasseio } from '@/components/chat/ChatDonoModal';

const CLASSE_BOTAO =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-marinho px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-marinho-escuro active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa disabled:opacity-70';

/**
 * "Conversar com {nome}" na seção do operador (SPEC §99). Reaproveita o chat do dono que já
 * existe: no roteiro abre a conversa em modal (`ChatDonoDialog`); na embarcação segue para
 * `/embarcacoes/[id]/chat`. Nenhum fluxo de chat novo.
 */
export default function OperadorChatBotao({
  nome,
  roteiro,
  embarcacaoId,
}: {
  /** Como o botão chama o operador ("Jayme"). */
  nome: string;
  /** Origem da conversa quando a seção está num roteiro. */
  roteiro?: { id: string; nome: string };
  /** Origem da conversa quando a seção está numa embarcação. */
  embarcacaoId?: string;
}) {
  const t = useTranslations('Operador');
  const tChat = useTranslations('Chat');
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [indo, setIndo] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    botaoRef.current?.focus();
  }, []);

  const irParaLogin = useCallback(() => {
    if (!roteiro) return;
    setAberto(false);
    setIndo(true);
    router.push(`/roteiros/${roteiro.id}/chat`);
  }, [router, roteiro]);

  if (roteiro) {
    return (
      <>
        <button
          ref={botaoRef}
          type="button"
          onClick={() => setAberto(true)}
          disabled={indo}
          aria-haspopup="dialog"
          className={CLASSE_BOTAO}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('conversar', { nome })}
        </button>
        <ChatDonoDialog
          alvo={{ tipo: 'roteiro', id: roteiro.id }}
          aberto={aberto}
          onFechar={fechar}
          origem="roteiro"
          onSemSessao={irParaLogin}
          saudacao={saudacaoPasseio(tChat, roteiro.nome)}
        />
      </>
    );
  }

  if (embarcacaoId) {
    return (
      <Link href={`/embarcacoes/${embarcacaoId}/chat`} className={CLASSE_BOTAO}>
        <MessageCircle className="h-4 w-4" aria-hidden />
        {t('conversar', { nome })}
      </Link>
    );
  }

  return null;
}
