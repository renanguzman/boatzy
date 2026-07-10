'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { EmbarcacaoStatus } from '@/types/supabase';

type ActionResult = { ok: boolean; error?: string };

async function requireAdmin(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };

  return { ok: true };
}

/**
 * Ativa ou desativa qualquer embarcação da plataforma (visão admin).
 * Mesmo cascade do painel do gestor: ao desativar, os roteiros vinculados
 * ficam inativos; ao reativar, voltam a ficar ativos.
 */
export async function alternarStatusEmbarcacaoAdmin(
  embarcacaoId: string,
  novoStatus: Extract<EmbarcacaoStatus, 'ativo' | 'inativo'>,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await supabaseAdmin
    .from('embarcacao')
    .update({ status: novoStatus })
    .eq('id', embarcacaoId);

  if (error) return { ok: false, error: error.message };

  await supabaseAdmin
    .from('roteiro')
    .update({ ativo: novoStatus === 'ativo' })
    .eq('embarcacao_id', embarcacaoId);

  revalidatePath('/administrator/embarcacoes');
  return { ok: true };
}
