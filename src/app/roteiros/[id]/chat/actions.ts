'use server';

import { createClient } from '@/lib/supabase/server';
import { carregarChatRoteiro, type ChatDonoDados } from '@/lib/chat-dono';

/**
 * Abre o chat com o dono do roteiro sem sair da página (modal da confirmação da
 * reserva e do detalhe do roteiro). Mesma lógica da página `/roteiros/[id]/chat`.
 */
export async function abrirChatRoteiro(
  roteiroId: string,
): Promise<{ ok: true; dados: ChatDonoDados } | { ok: false; error: string; semSessao?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Deslogado: quem chamou leva ao login (a página de chat volta com o texto preservado).
  if (!user) return { ok: false, semSessao: true, error: 'Entre na sua conta para conversar com o dono.' };

  const resultado = await carregarChatRoteiro(roteiroId, user.id);
  if (resultado.ok) return resultado;
  return {
    ok: false,
    error: resultado.motivo === 'dono'
      ? 'Este roteiro é seu — não dá para conversar consigo mesmo.'
      : 'Não foi possível abrir a conversa com o dono deste roteiro.',
  };
}
