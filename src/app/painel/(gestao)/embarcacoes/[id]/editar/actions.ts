'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { buildKeyFromUrl, deleteFromR2 } from '@/lib/r2';
import type { EmbarcacaoStatus } from '@/types/supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AtualizarEmbarcacaoPayload = {
  nome: string;
  descricao: string;
  embarcacao_tipo_id: string;
  embarcacao_categoria_id: string;
  status: EmbarcacaoStatus;
  capacidade: string;
  comprimento: string;
  cabines: string;
  tripulacao: string;
  preco_base: string;
  municipio_id: string;
  cep: string;
  bairro: string;
  logradouro: string;
  logradouro_numero: string;
  complemento: string;
};

type ActionResult = { ok: boolean; error?: string };

// ─── Helper de autenticação + ownership ──────────────────────────────────────

async function getAuthorizedUser(embarcacaoId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: 'Não autenticado.' };

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkId)
    .single();

  if (!dbUser) return { error: 'Usuário não encontrado.' };

  const autorizado = await checkRoleInDb(dbUser.id, ['gestor', 'admin']);
  if (!autorizado) return { error: 'Acesso não autorizado.' };

  // Confirma que a embarcação pertence ao usuário
  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', dbUser.id)
    .single();

  if (!emb) return { error: 'Embarcação não encontrada ou sem permissão.' };

  return { dbUser, ok: true as const };
}

// ─── Action: atualizar embarcação ─────────────────────────────────────────────

export async function atualizarEmbarcacao(
  embarcacaoId: string,
  payload: AtualizarEmbarcacaoPayload,
): Promise<ActionResult> {
  const auth = await getAuthorizedUser(embarcacaoId);
  if ('error' in auth && auth.error) return { ok: false, error: auth.error };

  if (!payload.nome.trim()) return { ok: false, error: 'O nome da embarcação é obrigatório.' };

  const { error } = await supabaseAdmin
    .from('embarcacao')
    .update({
      nome:        payload.nome.trim(),
      descricao:   payload.descricao.trim() || null,
      embarcacao_tipo_id:      payload.embarcacao_tipo_id      || null,
      embarcacao_categoria_id: payload.embarcacao_categoria_id || null,
      status:      payload.status,
      capacidade:  payload.capacidade  ? parseInt(payload.capacidade,  10) : null,
      comprimento: payload.comprimento ? parseFloat(payload.comprimento)   : null,
      cabines:     payload.cabines     ? parseInt(payload.cabines,     10) : null,
      tripulacao:  payload.tripulacao  ? parseInt(payload.tripulacao,  10) : null,
      preco_base:  payload.preco_base  ? parseFloat(payload.preco_base)    : null,
      municipio_id: payload.municipio_id ? parseInt(payload.municipio_id, 10) : null,
      cep:               payload.cep.replace(/\D/g, '')   || null,
      bairro:            payload.bairro.trim()             || null,
      logradouro:        payload.logradouro.trim()         || null,
      logradouro_numero: payload.logradouro_numero.trim()  || null,
      complemento:       payload.complemento.trim()        || null,
    })
    .eq('id', embarcacaoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: excluir imagem ───────────────────────────────────────────────────

export async function excluirImagem(
  embarcacaoId: string,
  imagemId: string,
): Promise<ActionResult> {
  const auth = await getAuthorizedUser(embarcacaoId);
  if ('error' in auth && auth.error) return { ok: false, error: auth.error };

  // Busca a URL antes de deletar para poder remover do R2
  const { data: imagem } = await supabaseAdmin
    .from('embarcacao_imagens')
    .select('url_imagem')
    .eq('id', imagemId)
    .eq('embarcacao_id', embarcacaoId)
    .single();

  // Remove do R2 (silencia erros — o registro do banco é deletado de qualquer forma)
  if (imagem?.url_imagem) {
    const key = buildKeyFromUrl(imagem.url_imagem);
    await deleteFromR2(key).catch(() => null);
  }

  const { error } = await supabaseAdmin
    .from('embarcacao_imagens')
    .delete()
    .eq('id', imagemId)
    .eq('embarcacao_id', embarcacaoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: definir imagem principal ────────────────────────────────────────

export async function definirPrincipal(
  embarcacaoId: string,
  imagemId: string,
): Promise<ActionResult> {
  const auth = await getAuthorizedUser(embarcacaoId);
  if ('error' in auth && auth.error) return { ok: false, error: auth.error };

  await supabaseAdmin
    .from('embarcacao_imagens')
    .update({ principal: false })
    .eq('embarcacao_id', embarcacaoId);

  const { error } = await supabaseAdmin
    .from('embarcacao_imagens')
    .update({ principal: true })
    .eq('id', imagemId)
    .eq('embarcacao_id', embarcacaoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: excluir regra de preço ──────────────────────────────────────────

export async function excluirRegra(
  embarcacaoId: string,
  regraId: string,
): Promise<ActionResult> {
  const auth = await getAuthorizedUser(embarcacaoId);
  if ('error' in auth && auth.error) return { ok: false, error: auth.error };

  const { error } = await supabaseAdmin
    .from('embarcacao_preco_regra')
    .delete()
    .eq('id', regraId)
    .eq('embarcacao_id', embarcacaoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
