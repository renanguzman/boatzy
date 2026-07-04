'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export type AlternarFavoritoResult =
  | { ok: true; favorito: boolean }
  | { ok: false; error: 'nao_autenticado' | 'erro' };

/**
 * Alterna o favorito do usuário logado para um roteiro (insere se não existe,
 * remove se existe). 'nao_autenticado' sinaliza ao client que deve redirecionar
 * para /entrar. Usada pelo detalhe do roteiro e pela página /favoritos.
 */
export async function alternarFavorito(roteiroId: string): Promise<AlternarFavoritoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'nao_autenticado' };

  const { data: existente } = await supabaseAdmin
    .from('favorito')
    .select('id')
    .eq('user_id', user.id)
    .eq('roteiro_id', roteiroId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabaseAdmin.from('favorito').delete().eq('id', existente.id);
    if (error) {
      console.error('[alternarFavorito] falha ao remover:', error);
      return { ok: false, error: 'erro' };
    }
    revalidatePath('/favoritos');
    revalidatePath(`/roteiros/${roteiroId}`);
    return { ok: true, favorito: false };
  }

  const { error } = await supabaseAdmin
    .from('favorito')
    .insert({ user_id: user.id, roteiro_id: roteiroId });
  if (error) {
    // 23505 = corrida com outro insert do mesmo par — já está favoritado.
    if (error.code === '23505') return { ok: true, favorito: true };
    console.error('[alternarFavorito] falha ao inserir:', error);
    return { ok: false, error: 'erro' };
  }

  revalidatePath('/favoritos');
  revalidatePath(`/roteiros/${roteiroId}`);
  return { ok: true, favorito: true };
}
