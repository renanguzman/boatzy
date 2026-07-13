'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { AnuncioInteracaoTipo } from '@/types/supabase';

/**
 * Registra um evento do funil para o usuário logado (idempotente via UNIQUE
 * anuncio/user/tipo). Interações do PRÓPRIO DONO do anúncio são ignoradas —
 * o gestor não é lead de si mesmo.
 */
async function registrarInteracao(
  anuncioId: string,
  userId: string,
  ownerId: string,
  tipo: AnuncioInteracaoTipo,
): Promise<void> {
  if (userId === ownerId) return;
  const { error } = await supabaseAdmin
    .from('anuncio_venda_interacao')
    .insert({ anuncio_id: anuncioId, user_id: userId, tipo });
  // 23505 = evento já registrado (idempotência esperada).
  if (error && error.code !== '23505') {
    console.error(`[vendas] falha ao registrar interação ${tipo}:`, error);
  }
}

/** Carrega o anúncio publicamente visível (ativo + embarcação ativa) ou null. */
async function getAnuncioVisivel(anuncioId: string) {
  const { data } = await supabaseAdmin
    .from('anuncio_venda')
    .select('id, owner_id, status, embarcacao ( status )')
    .eq('id', anuncioId)
    .eq('status', 'ativo')
    .single();
  const emb = data?.embarcacao as unknown as { status: string } | null;
  if (!data || emb?.status !== 'ativo') return null;
  return data;
}

export type RevelarContatoResult =
  | { ok: true; vendedor: { nome: string; email: string; avatar_url: string | null } }
  | { ok: false; error: 'nao_autenticado' | 'erro' };

/**
 * Revela os dados do vendedor (nome completo + e-mail) para o usuário logado
 * e registra o evento `revelou_contato` (estágio 2 do funil). Os dados nunca
 * são pré-renderizados na página — só saem do servidor por esta action.
 */
export async function revelarContatoVendedor(anuncioId: string): Promise<RevelarContatoResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'nao_autenticado' };

  const anuncio = await getAnuncioVisivel(anuncioId);
  if (!anuncio) return { ok: false, error: 'erro' };

  const { data: vendedor } = await supabaseAdmin
    .from('users')
    .select('name, email, avatar_url')
    .eq('id', anuncio.owner_id)
    .single();
  if (!vendedor) return { ok: false, error: 'erro' };

  await registrarInteracao(anuncioId, user.id, anuncio.owner_id, 'revelou_contato');

  return {
    ok: true,
    vendedor: { nome: vendedor.name, email: vendedor.email, avatar_url: vendedor.avatar_url },
  };
}

/**
 * Registra o evento `compartilhou` (estágio 4 do funil). Chamada pelo menu de
 * compartilhamento; deslogado não pontua (o compartilhamento em si funciona
 * no client de qualquer forma).
 */
export async function registrarCompartilhamentoAnuncio(anuncioId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const anuncio = await getAnuncioVisivel(anuncioId);
  if (!anuncio) return;

  await registrarInteracao(anuncioId, user.id, anuncio.owner_id, 'compartilhou');
}
