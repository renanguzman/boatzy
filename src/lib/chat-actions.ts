'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

type ActionResult = { ok: boolean; error?: string };

/**
 * Server actions genéricas do chat, usadas pelos dois lados (painel do gestor e
 * site do cliente). Validam que o usuário logado participa da conversa.
 */

/** Valida que o usuário logado participa da conversa; retorna o user.id. */
async function ensureParticipante(conversaId: string): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };

  const { data: conversa } = await supabaseAdmin
    .from('conversa')
    .select('id, gestor_id, cliente_id')
    .eq('id', conversaId)
    .single();

  if (!conversa || (conversa.gestor_id !== user.id && conversa.cliente_id !== user.id)) {
    return { error: 'Conversa não encontrada ou sem permissão.' };
  }

  return { userId: user.id };
}

/** Envia uma mensagem de texto na conversa, como o usuário logado. */
export async function enviarMensagem(conversaId: string, conteudo: string): Promise<ActionResult> {
  const texto = conteudo.trim();
  if (!texto) return { ok: false, error: 'Mensagem vazia.' };
  if (texto.length > 4000) return { ok: false, error: 'Mensagem muito longa (máx. 4000 caracteres).' };

  const guard = await ensureParticipante(conversaId);
  if ('error' in guard) return { ok: false, error: guard.error };

  const { error } = await supabaseAdmin
    .from('mensagem')
    .insert({ conversa_id: conversaId, remetente_id: guard.userId, conteudo: texto });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel/clientes');
  revalidatePath('/minhas-reservas');
  return { ok: true };
}

/**
 * Marca como lidas todas as mensagens da conversa enviadas pela outra parte
 * (não pelo usuário logado) que ainda não foram lidas.
 */
export async function marcarConversaComoLida(conversaId: string): Promise<ActionResult> {
  const guard = await ensureParticipante(conversaId);
  if ('error' in guard) return { ok: false, error: guard.error };

  const { error } = await supabaseAdmin
    .from('mensagem')
    .update({ lida_em: new Date().toISOString() })
    .eq('conversa_id', conversaId)
    .neq('remetente_id', guard.userId)
    .is('lida_em', null);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel/clientes');
  revalidatePath('/minhas-reservas');
  return { ok: true };
}
