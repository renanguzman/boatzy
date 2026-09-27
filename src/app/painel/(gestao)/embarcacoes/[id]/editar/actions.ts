'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { buildKeyFromUrl, deleteFromR2 } from '@/lib/r2';
import type { EmbarcacaoStatus, ModalidadeCapitao } from '@/types/supabase';
import { isComprimentoUnidade, type ComprimentoUnidade } from '@/lib/comprimento';
import { normalizarTituloImagem } from '@/lib/galeria';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AtualizarEmbarcacaoPayload = {
  nome: string;
  descricao: string;
  embarcacao_tipo_id: string;
  status: EmbarcacaoStatus;
  modalidade_capitao: ModalidadeCapitao;
  capacidade: string;
  comprimento: string;
  comprimento_unidade: ComprimentoUnidade;
  quartos: string;
  suites: string;
  banheiros: string;
  tripulacao: string;
  preco_base: string;
  municipio_id: string;
  latitude: string;
  longitude: string;
  cep: string;
  bairro: string;
  logradouro: string;
  logradouro_numero: string;
  complemento: string;
  /** Dias da semana em que a embarcação opera (0=Dom..6=Sáb). Vazio = todos os dias. */
  disponibilidade_dias_semana: number[];
};

type ActionResult = { ok: boolean; error?: string };

// ─── Helper de autenticação + ownership ──────────────────────────────────────

async function getAuthorizedUser(embarcacaoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { error: 'Acesso não autorizado.' };

  // Admin pode editar qualquer embarcação; gestor apenas as próprias.
  const isAdmin = await checkRoleInDb(user.id, ['admin']);

  let query = supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId);
  if (!isAdmin) query = query.eq('owner_id', user.id);

  const { data: emb } = await query.single();
  if (!emb) return { error: 'Embarcação não encontrada ou sem permissão.' };

  return { userId: user.id, ok: true as const };
}

// ─── Action: atualizar embarcação ─────────────────────────────────────────────

export async function atualizarEmbarcacao(
  embarcacaoId: string,
  payload: AtualizarEmbarcacaoPayload,
): Promise<ActionResult> {
  const result = await getAuthorizedUser(embarcacaoId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  if (!payload.nome.trim()) return { ok: false, error: 'O nome da embarcação é obrigatório.' };

  const { error } = await supabaseAdmin
    .from('embarcacao')
    .update({
      nome: payload.nome.trim(),
      descricao: payload.descricao.trim() || null,
      embarcacao_tipo_id: payload.embarcacao_tipo_id || null,
      status: payload.status,
      modalidade_capitao: payload.modalidade_capitao,
      capacidade: payload.capacidade ? parseInt(payload.capacidade, 10) : null,
      comprimento: payload.comprimento ? parseFloat(payload.comprimento) : null,
      comprimento_unidade: isComprimentoUnidade(payload.comprimento_unidade) ? payload.comprimento_unidade : 'm',
      quartos: payload.quartos ? parseInt(payload.quartos, 10) : null,
      suites: payload.suites ? parseInt(payload.suites, 10) : null,
      banheiros: payload.banheiros !== '' ? parseInt(payload.banheiros, 10) : null,
      tripulacao: payload.tripulacao ? parseInt(payload.tripulacao, 10) : null,
      preco_base: payload.preco_base ? parseFloat(payload.preco_base) : null,
      municipio_id: payload.municipio_id ? parseInt(payload.municipio_id, 10) : null,
      latitude: payload.latitude ? parseFloat(payload.latitude) : null,
      longitude: payload.longitude ? parseFloat(payload.longitude) : null,
      cep: payload.cep.replace(/\D/g, '') || null,
      bairro: payload.bairro.trim() || null,
      logradouro: payload.logradouro.trim() || null,
      logradouro_numero: payload.logradouro_numero.trim() || null,
      complemento: payload.complemento.trim() || null,
      disponibilidade_dias_semana:
        payload.disponibilidade_dias_semana.length > 0 ? payload.disponibilidade_dias_semana : null,
    })
    .eq('id', embarcacaoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: salvar datas bloqueadas (disponibilidade) ───────────────────────

export async function salvarBloqueiosEmbarcacao(
  embarcacaoId: string,
  datas: string[],
): Promise<ActionResult> {
  const result = await getAuthorizedUser(embarcacaoId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  // Substitui o conjunto de bloqueios pelo informado.
  await supabaseAdmin
    .from('embarcacao_disponibilidade_bloqueio')
    .delete()
    .eq('embarcacao_id', embarcacaoId);

  if (datas.length === 0) return { ok: true };

  const rows = datas.map(data => ({ embarcacao_id: embarcacaoId, data }));
  const { error } = await supabaseAdmin
    .from('embarcacao_disponibilidade_bloqueio')
    .insert(rows);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: excluir imagem ───────────────────────────────────────────────────

export async function excluirImagem(
  embarcacaoId: string,
  imagemId: string,
): Promise<ActionResult> {
  const result = await getAuthorizedUser(embarcacaoId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  const { data: imagem } = await supabaseAdmin
    .from('embarcacao_imagens')
    .select('url_imagem')
    .eq('id', imagemId)
    .eq('embarcacao_id', embarcacaoId)
    .single();

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

// ─── Action: atualizar título, ordem e principal das imagens salvas ─────────

export type ImagemGaleriaUpdate = { id: string; titulo: string; ordem: number; principal: boolean };

/**
 * Grava a galeria editada no `GaleriaImagensEditor` para as imagens que já
 * existiam: título, posição e qual é a principal. Imagens novas são inseridas
 * depois via upload (com a própria `ordem`).
 */
export async function atualizarImagens(
  embarcacaoId: string,
  imagens: ImagemGaleriaUpdate[],
): Promise<ActionResult> {
  const result = await getAuthorizedUser(embarcacaoId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  // Zera a principal antes para nunca existirem duas ao mesmo tempo.
  if (imagens.some(i => i.principal)) {
    await supabaseAdmin.from('embarcacao_imagens').update({ principal: false }).eq('embarcacao_id', embarcacaoId);
  }

  const results = await Promise.all(imagens.map(img =>
    supabaseAdmin
      .from('embarcacao_imagens')
      .update({
        titulo: normalizarTituloImagem(img.titulo),
        ordem: Math.max(0, Math.trunc(img.ordem)),
        principal: img.principal,
      })
      .eq('id', img.id)
      .eq('embarcacao_id', embarcacaoId),
  ));

  const falha = results.find(r => r.error);
  if (falha?.error) return { ok: false, error: falha.error.message };
  return { ok: true };
}

// ─── Action: substituir comodidades vinculadas ────────────────────────────────

export async function atualizarComodidades(
  embarcacaoId: string,
  comodidadeIds: string[],
): Promise<ActionResult> {
  const result = await getAuthorizedUser(embarcacaoId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  await supabaseAdmin
    .from('embarcacao_comodidades')
    .delete()
    .eq('embarcacao_id', embarcacaoId);

  if (comodidadeIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('embarcacao_comodidades')
      .insert(comodidadeIds.map(comodidade_id => ({ embarcacao_id: embarcacaoId, comodidade_id })));
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── Action: excluir regra de preço ──────────────────────────────────────────

export async function excluirRegra(
  embarcacaoId: string,
  regraId: string,
): Promise<ActionResult> {
  const result = await getAuthorizedUser(embarcacaoId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  const { error } = await supabaseAdmin
    .from('embarcacao_preco_regra')
    .delete()
    .eq('id', regraId)
    .eq('embarcacao_id', embarcacaoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
