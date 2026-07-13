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

/**
 * Alterna o favorito do usuário logado para uma embarcação (mesma semântica
 * de alternarFavorito). Usada pelos cards de embarcação (home "Mais Bem
 * Avaliadas") e pela página /favoritos.
 */
export async function alternarFavoritoEmbarcacao(
  embarcacaoId: string,
): Promise<AlternarFavoritoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'nao_autenticado' };

  const { data: existente } = await supabaseAdmin
    .from('favorito')
    .select('id')
    .eq('user_id', user.id)
    .eq('embarcacao_id', embarcacaoId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabaseAdmin.from('favorito').delete().eq('id', existente.id);
    if (error) {
      console.error('[alternarFavoritoEmbarcacao] falha ao remover:', error);
      return { ok: false, error: 'erro' };
    }
    revalidatePath('/favoritos');
    return { ok: true, favorito: false };
  }

  const { error } = await supabaseAdmin
    .from('favorito')
    .insert({ user_id: user.id, embarcacao_id: embarcacaoId });
  if (error) {
    // 23505 = corrida com outro insert do mesmo par — já está favoritado.
    if (error.code === '23505') return { ok: true, favorito: true };
    console.error('[alternarFavoritoEmbarcacao] falha ao inserir:', error);
    return { ok: false, error: 'erro' };
  }

  revalidatePath('/favoritos');
  return { ok: true, favorito: true };
}

/**
 * Alterna o favorito do usuário logado para um anúncio de venda (mesma
 * semântica das demais). Favoritar registra também o evento `favoritou` no
 * funil do anúncio (idempotente; desfavoritar NÃO remove o evento — o funil
 * mede interesse demonstrado). O dono do anúncio não vira lead de si mesmo.
 */
export async function alternarFavoritoAnuncio(
  anuncioId: string,
): Promise<AlternarFavoritoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'nao_autenticado' };

  const { data: existente } = await supabaseAdmin
    .from('favorito')
    .select('id')
    .eq('user_id', user.id)
    .eq('anuncio_venda_id', anuncioId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabaseAdmin.from('favorito').delete().eq('id', existente.id);
    if (error) {
      console.error('[alternarFavoritoAnuncio] falha ao remover:', error);
      return { ok: false, error: 'erro' };
    }
    revalidatePath('/favoritos');
    revalidatePath(`/vendas/${anuncioId}`);
    return { ok: true, favorito: false };
  }

  const { error } = await supabaseAdmin
    .from('favorito')
    .insert({ user_id: user.id, anuncio_venda_id: anuncioId });
  if (error && error.code !== '23505') {
    // 23505 = corrida com outro insert do mesmo par — já está favoritado.
    console.error('[alternarFavoritoAnuncio] falha ao inserir:', error);
    return { ok: false, error: 'erro' };
  }

  // Evento do funil (estágio 3): só se o usuário não é o dono do anúncio.
  const { data: anuncio } = await supabaseAdmin
    .from('anuncio_venda')
    .select('owner_id')
    .eq('id', anuncioId)
    .single();
  if (anuncio && anuncio.owner_id !== user.id) {
    const { error: evErro } = await supabaseAdmin
      .from('anuncio_venda_interacao')
      .insert({ anuncio_id: anuncioId, user_id: user.id, tipo: 'favoritou' });
    if (evErro && evErro.code !== '23505') {
      console.error('[alternarFavoritoAnuncio] falha ao registrar evento:', evErro);
    }
  }

  revalidatePath('/favoritos');
  revalidatePath(`/vendas/${anuncioId}`);
  return { ok: true, favorito: true };
}
