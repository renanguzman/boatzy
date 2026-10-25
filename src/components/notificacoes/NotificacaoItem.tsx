'use client';

import Link from 'next/link';
import { quandoNotificacao, tituloNotificacao, visualNotificacao, type Notificacao } from '@/lib/notificacoes/apresentacao';

/**
 * Linha de notificação (sino e /notificacoes): ícone colorido por tipo,
 * título, texto (2 linhas no compacto), tempo relativo e ponto de não lida.
 * Clicar marca como lida e segue o link.
 */
export default function NotificacaoItem({
  n,
  onAbrir,
  compacto = false,
}: {
  n: Notificacao;
  onAbrir: (n: Notificacao) => void;
  compacto?: boolean;
}) {
  const { icone: Icone, cor } = visualNotificacao(n.tipo);
  const naoLida = !n.lida_em;

  const conteudo = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cor}`}>
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm leading-snug ${naoLida ? 'font-semibold text-marinho' : 'font-medium text-slate-600'}`}>
          {tituloNotificacao(n)}
        </span>
        <span className={`mt-0.5 block text-xs leading-relaxed text-slate-500 ${compacto ? 'line-clamp-2' : ''}`}>
          {n.mensagem}
        </span>
        <span className="mt-1 block text-[11px] text-slate-400">{quandoNotificacao(n.criada_em)}</span>
      </span>
      {naoLida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marinho" aria-label="Não lida" />}
    </>
  );

  const classe = `flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${naoLida ? 'bg-marinho/[0.04]' : ''}`;

  return n.link ? (
    <Link href={n.link} onClick={() => onAbrir(n)} role="menuitem" className={classe}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={() => onAbrir(n)} role="menuitem" className={`w-full ${classe}`}>
      {conteudo}
    </button>
  );
}
