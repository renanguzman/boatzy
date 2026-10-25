'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { EVENTO_AVISO_GESTOR } from './NotificacoesBell';

/** Telas que mostram reservas/pagamentos e devem refletir avisos novos na hora. */
function deveAtualizar(pathname: string): boolean {
  return pathname === '/painel' || pathname.startsWith('/painel/agendamentos');
}

/**
 * Quando chega um aviso novo ao gestor (nova solicitação, pagamento, cancelamento —
 * `EVENTO_AVISO_GESTOR`, disparado pelo sino via Realtime), recarrega os dados do
 * servidor da tela atual sem perder o estado da página. Só no dashboard e em
 * agendamentos — formulários não são recarregados (SPEC §87).
 */
export default function AtualizarAoVivo() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!deveAtualizar(pathname)) return;
    const atualizar = () => router.refresh();
    window.addEventListener(EVENTO_AVISO_GESTOR, atualizar);
    return () => window.removeEventListener(EVENTO_AVISO_GESTOR, atualizar);
  }, [pathname, router]);

  return null;
}
