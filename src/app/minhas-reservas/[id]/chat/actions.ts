'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { carregarChatReserva, type ChatDonoDados } from '@/lib/chat-dono';

/**
 * Abre o chat com o dono a partir de uma reserva do cliente, sem sair da página (modal do
 * detalhe e da lista de Minhas reservas). Mesma lógica da página `/minhas-reservas/[id]/chat`.
 */
export async function abrirChatReserva(
  reservaId: string,
): Promise<{ ok: true; dados: ChatDonoDados } | { ok: false; error: string; semSessao?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations('Chat.erros');
  if (!user) return { ok: false, semSessao: true, error: t('entreNaConta') };

  const resultado = await carregarChatReserva(reservaId, user.id);
  if (resultado.ok) return resultado;
  return {
    ok: false,
    error: resultado.motivo === 'dono'
      ? t('reservaSua')
      : t('falhaReserva'),
  };
}
