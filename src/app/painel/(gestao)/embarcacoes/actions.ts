'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { EmbarcacaoStatus } from '@/types/supabase';

type ActionResult = { ok: boolean; error?: string };

/**
 * Ativa ou desativa uma embarcação a partir da listagem do painel.
 * Ao desativar, os roteiros vinculados também ficam inativos (somem da busca).
 * Ao reativar, os roteiros vinculados voltam a ficar ativos (cascade simétrico).
 */
export async function alternarStatusEmbarcacao(
  embarcacaoId: string,
  novoStatus: Extract<EmbarcacaoStatus, 'ativo' | 'inativo'>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  // Garante posse da embarcação.
  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', user.id)
    .single();

  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

  const { error } = await supabaseAdmin
    .from('embarcacao')
    .update({ status: novoStatus })
    .eq('id', embarcacaoId);

  if (error) return { ok: false, error: error.message };

  // Cascade para os roteiros vinculados: inativo desativa, ativo reativa.
  await supabaseAdmin
    .from('roteiro')
    .update({ ativo: novoStatus === 'ativo' })
    .eq('embarcacao_id', embarcacaoId);

  revalidatePath('/painel/embarcacoes');
  revalidatePath('/painel/roteiros');
  return { ok: true };
}
