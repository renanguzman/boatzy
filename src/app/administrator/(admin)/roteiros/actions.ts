'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

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
 * Ativa ou desativa qualquer roteiro da plataforma (visão admin).
 * Roteiros inativos não aparecem na busca do cliente nem por link direto.
 */
export async function alternarStatusRoteiroAdmin(
  roteiroId: string,
  ativo: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await supabaseAdmin
    .from('roteiro')
    .update({ ativo })
    .eq('id', roteiroId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/roteiros');
  return { ok: true };
}
