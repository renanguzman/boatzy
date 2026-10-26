'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { ChatDonoDialog, useSugestoesChat } from '@/components/chat/ChatDonoModal';

/**
 * "Conversar com o dono" de uma reserva (lista e detalhe de Minhas reservas): abre a conversa em
 * modal por cima da página, com assuntos de quem já reservou e a abertura citando o passeio, a
 * data e o código da reserva. Ao fechar, atualiza a página (o contador de não lidas zera).
 */
export default function ConversarDonoReserva({
  reservaId,
  itemNome,
  dataLabel,
  naoLidas = 0,
  variante,
}: {
  reservaId: string;
  itemNome: string;
  /** Data do passeio já formatada (ex.: 24/10/2026). */
  dataLabel: string;
  naoLidas?: number;
  /** `botao`: ação principal (detalhe). `link`: rodapé do card da lista. */
  variante: 'botao' | 'link';
}) {
  const router = useRouter();
  const t = useTranslations('Chat');
  const sugestoes = useSugestoesChat('reserva');
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    botaoRef.current?.focus();
    router.refresh();
  }, [router]);

  const contador = naoLidas > 0 && (
    <span
      className={
        variante === 'botao'
          ? 'min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none'
          : 'absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none'
      }
    >
      {naoLidas > 99 ? '99+' : naoLidas}
    </span>
  );

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className={
          variante === 'botao'
            ? 'flex w-full items-center justify-center gap-2 rounded-xl bg-marinho hover:bg-marinho-escuro px-4 py-2.5 text-sm font-semibold text-white transition-colors'
            : 'inline-flex items-center gap-2 text-sm font-medium text-marinho hover:text-turquesa-escuro transition-colors'
        }
      >
        {variante === 'botao' ? (
          <>
            <MessageCircle className="h-4 w-4" />
            {t('conversarComDono')}
            {contador}
          </>
        ) : (
          <>
            <span className="relative inline-flex">
              <MessageCircle className="h-4 w-4" />
              {contador}
            </span>
            {t('conversarComDono')}
          </>
        )}
      </button>

      <ChatDonoDialog
        alvo={{ tipo: 'reserva', id: reservaId }}
        aberto={aberto}
        onFechar={fechar}
        origem="minhas_reservas"
        sugestoes={sugestoes}
        saudacao={t('saudacaoReserva', { item: itemNome, data: dataLabel, codigo: reservaId.slice(0, 8).toUpperCase() })}
      />
    </>
  );
}
