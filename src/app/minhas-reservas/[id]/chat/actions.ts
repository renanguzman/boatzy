'use server';

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
  if (!user) return { ok: false, semSessao: true, error: 'Entre na sua conta para conversar com o dono.' };

  const resultado = await carregarChatReserva(reservaId, user.id);
  if (resultado.ok) return resultado;
  return {
    ok: false,
    error: resultado.motivo === 'dono'
      ? 'Esta reserva é de um item seu — não dá para conversar consigo mesmo.'
      : 'Não foi possível abrir a conversa com o dono desta reserva.',
  };
}
