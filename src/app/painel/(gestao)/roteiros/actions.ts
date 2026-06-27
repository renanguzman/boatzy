'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

type ActionResult = { ok: boolean; error?: string };

/**
 * Ativa ou desativa um roteiro a partir da listagem do painel.
 * Roteiros inativos não aparecem na busca do cliente nem por link direto.
 */
export async function alternarStatusRoteiro(
  roteiroId: string,
  ativo: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  // Garante posse do roteiro.
  const { data: roteiro } = await supabaseAdmin
    .from('roteiro')
    .select('id')
    .eq('id', roteiroId)
    .eq('owner_id', user.id)
    .single();

  if (!roteiro) return { ok: false, error: 'Roteiro não encontrado ou sem permissão.' };

  const { error } = await supabaseAdmin
    .from('roteiro')
    .update({ ativo })
    .eq('id', roteiroId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel/roteiros');
  return { ok: true };
}
