'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

type AbrirConversaResult =
  | { ok: true; conversaId: string }
  | { ok: false; error: string };

/**
 * Garante (idempotente) que exista uma conversa entre o gestor logado e o
 * cliente informado. Retorna o id da conversa.
 */
export async function abrirConversa(clienteId: string): Promise<AbrirConversaResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  if (clienteId === user.id) {
    return { ok: false, error: 'Não é possível abrir uma conversa consigo mesmo.' };
  }

  // Conversa já existente (o cliente puxou o assunto pelo roteiro, embarcação, reserva ou anúncio).
  const { data: existente } = await supabaseAdmin
    .from('conversa')
    .select('id')
    .eq('gestor_id', user.id)
    .eq('cliente_id', clienteId)
    .maybeSingle();
  if (existente) return { ok: true, conversaId: existente.id };

  // Sem conversa, o gestor só inicia com quem tem vínculo com ele: reserva ou lead de anúncio.
  if (!(await clienteVinculadoAoGestor(user.id, clienteId))) {
    return { ok: false, error: 'Cliente não encontrado.' };
  }

  // upsert idempotente pela constraint UNIQUE (gestor_id, cliente_id).
  const { data, error } = await supabaseAdmin
    .from('conversa')
    .upsert(
      { gestor_id: user.id, cliente_id: clienteId },
      { onConflict: 'gestor_id,cliente_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao abrir a conversa.' };
  }

  return { ok: true, conversaId: data.id };
}

/** O usuário já reservou com o gestor ou é lead de um anúncio de venda dele. */
async function clienteVinculadoAoGestor(gestorId: string, clienteId: string): Promise<boolean> {
  const [{ count: reservas }, { count: interacoes }] = await Promise.all([
    supabaseAdmin
      .from('reserva')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', gestorId)
      .eq('cliente_id', clienteId),
    supabaseAdmin
      .from('anuncio_venda_interacao')
      .select('id, anuncio_venda!inner ( owner_id )', { count: 'exact', head: true })
      .eq('user_id', clienteId)
      .eq('anuncio_venda.owner_id', gestorId),
  ]);
  return (reservas ?? 0) > 0 || (interacoes ?? 0) > 0;
}

// As actions genéricas de mensagem (enviarMensagem, marcarConversaComoLida) vivem
// em `@/lib/chat-actions` — compartilhadas pelos lados gestor e cliente.
