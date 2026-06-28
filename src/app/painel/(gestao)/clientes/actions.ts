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

// As actions genéricas de mensagem (enviarMensagem, marcarConversaComoLida) vivem
// em `@/lib/chat-actions` — compartilhadas pelos lados gestor e cliente.
