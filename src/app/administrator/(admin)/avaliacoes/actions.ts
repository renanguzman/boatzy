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

/** Aprova a avaliação: passa a aparecer nas páginas públicas do roteiro/embarcação. */
export async function aprovarAvaliacao(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await supabaseAdmin
    .from('avaliacao')
    .update({ status: 'aprovada' })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/avaliacoes');
  return { ok: true };
}

/** Edita nota e comentário de uma avaliação existente. */
export async function editarAvaliacao(
  id: string,
  dados: { nota: number; comentario: string },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const nota = Math.trunc(dados.nota);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return { ok: false, error: 'A nota deve ser um número inteiro de 1 a 5.' };
  }

  const comentario = dados.comentario.trim();
  if (comentario.length > 2000) {
    return { ok: false, error: 'O comentário deve ter no máximo 2000 caracteres.' };
  }

  const { error } = await supabaseAdmin
    .from('avaliacao')
    .update({ nota, comentario: comentario || null })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/avaliacoes');
  return { ok: true };
}

/** Exclui definitivamente uma avaliação. */
export async function excluirAvaliacao(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await supabaseAdmin.from('avaliacao').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/avaliacoes');
  return { ok: true };
}
