'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { verificarEdicaoSensivel } from '@/lib/publicacao/server';
import { normalizarRegras } from '@/lib/embarcacao-regras';
import type { ModalidadeCapitao } from '@/types/supabase';
import { isComprimentoUnidade, type ComprimentoUnidade } from '@/lib/comprimento';
import { normalizarTituloImagem } from '@/lib/galeria';
import { ehUrlDoStorage, ehUuid, prepararImagensNovas, type ImagemNovaPayload } from '@/lib/upload-imagem-server';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type CriarEmbarcacaoPayload = {
  /** Id gerado no formulário: as fotos sobem para o storage antes de o registro existir. */
  id: string;
  /** Fotos já enviadas ao storage (mínimo 1). */
  imagens: ImagemNovaPayload[];
  nome: string;
  descricao: string;
  embarcacao_tipo_id: string;
  modalidade_capitao: ModalidadeCapitao;
  capacidade: string;
  comprimento: string;
  comprimento_unidade: ComprimentoUnidade;
  quartos: string;
  banheiros: string;
  tripulacao: string;
  municipio_id: string;
  latitude: string;
  longitude: string;
  cep: string;
  bairro: string;
  logradouro: string;
  logradouro_numero: string;
  complemento: string;
  /** Regras a bordo (tags); normalizadas no servidor (`normalizarRegras`). */
  regras: string[];
};

export type CriarEmbarcacaoResult =
  | { ok: true; embarcacaoId: string; ownerId: string }
  | { ok: false; error: string };

export type SalvarImagemPayload = {
  embarcacaoId: string;
  urlImagem: string;
  titulo?: string;
  principal: boolean;
  /** Posição na galeria (0 = primeira). */
  ordem?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Action: criar embarcação
// ─────────────────────────────────────────────────────────────────────────────

export async function criarEmbarcacao(
  payload: CriarEmbarcacaoPayload,
): Promise<CriarEmbarcacaoResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  if (!payload.nome.trim()) {
    return { ok: false, error: 'O nome da embarcação é obrigatório.' };
  }

  if (!ehUuid(payload.id)) return { ok: false, error: 'Cadastro inválido. Recarregue a página e tente novamente.' };
  const imagens = prepararImagensNovas(payload.imagens);
  if (!imagens.ok) return { ok: false, error: imagens.error };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  const { data, error } = await supabaseAdmin
    .from('embarcacao')
    .insert({
      id: payload.id,
      owner_id: user.id,
      nome: payload.nome.trim(),
      descricao: payload.descricao.trim() || null,
      embarcacao_tipo_id: payload.embarcacao_tipo_id || null,
      modalidade_capitao: payload.modalidade_capitao,
      capacidade: payload.capacidade ? parseInt(payload.capacidade, 10) : null,
      comprimento: payload.comprimento ? parseFloat(payload.comprimento) : null,
      comprimento_unidade: isComprimentoUnidade(payload.comprimento_unidade) ? payload.comprimento_unidade : 'm',
      quartos: payload.quartos ? parseInt(payload.quartos, 10) : null,
      banheiros: payload.banheiros !== '' ? parseInt(payload.banheiros, 10) : null,
      tripulacao: payload.tripulacao ? parseInt(payload.tripulacao, 10) : null,
      municipio_id: payload.municipio_id ? parseInt(payload.municipio_id, 10) : null,
      latitude: payload.latitude ? parseFloat(payload.latitude) : null,
      longitude: payload.longitude ? parseFloat(payload.longitude) : null,
      cep: payload.cep.replace(/\D/g, '') || null,
      bairro: payload.bairro.trim() || null,
      logradouro: payload.logradouro.trim() || null,
      logradouro_numero: payload.logradouro_numero.trim() || null,
      complemento: payload.complemento.trim() || null,
      regras: normalizarRegras(payload.regras),
    })
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: 'Esta embarcação já foi cadastrada. Confira a lista de embarcações.' };
    return { ok: false, error: error?.message ?? 'Erro ao salvar embarcação.' };
  }

  // Sem as fotos o cadastro não vale: desfaz a embarcação se o registro delas falhar.
  const { error: imgErr } = await supabaseAdmin
    .from('embarcacao_imagens')
    .insert(imagens.linhas.map(l => ({ ...l, embarcacao_id: data.id })));
  if (imgErr) {
    await supabaseAdmin.from('embarcacao').delete().eq('id', data.id);
    return { ok: false, error: `Não foi possível registrar as fotos (${imgErr.message}). Nada foi salvo — tente novamente.` };
  }

  return { ok: true, embarcacaoId: data.id, ownerId: user.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: salvar registro de imagem após upload no R2
// ─────────────────────────────────────────────────────────────────────────────

export async function salvarImagem(
  payload: SalvarImagemPayload,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  // Admin pode gerenciar imagens de qualquer embarcação; gestor apenas as próprias.
  const isAdmin = await checkRoleInDb(user.id, ['admin']);

  let query = supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', payload.embarcacaoId);
  if (!isAdmin) query = query.eq('owner_id', user.id);

  const { data: emb } = await query.single();
  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };
  if (!ehUrlDoStorage(payload.urlImagem)) return { ok: false, error: 'A foto não foi enviada corretamente. Envie-a novamente.' };

  if (payload.principal) {
    await supabaseAdmin
      .from('embarcacao_imagens')
      .update({ principal: false })
      .eq('embarcacao_id', payload.embarcacaoId);
  }

  const { error } = await supabaseAdmin.from('embarcacao_imagens').insert({
    embarcacao_id: payload.embarcacaoId,
    url_imagem: payload.urlImagem,
    titulo: normalizarTituloImagem(payload.titulo),
    principal: payload.principal,
    ordem: Math.max(0, Math.trunc(payload.ordem ?? 0)),
  });

  if (error) return { ok: false, error: error.message };
  // Foto nova em embarcação Ativa é edição sensível (pipeline de aprovação).
  await verificarEdicaoSensivel('embarcacao', payload.embarcacaoId, user.id, isAdmin ? 'admin' : 'gestor');
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: buscar municípios por estado (cascade Estado → Município)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMunicipiosByEstado(
  estadoId: number,
): Promise<{ id: number; nome: string }[]> {
  const { data } = await supabaseAdmin
    .from('municipios')
    .select('id, nome')
    .eq('estado_id', estadoId)
    .order('nome');

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: buscar todas as comodidades disponíveis
// ─────────────────────────────────────────────────────────────────────────────

export async function getComodidades(): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabaseAdmin
    .from('comodidade')
    .select('id, nome')
    .order('nome');

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: salvar comodidades vinculadas a uma embarcação
// ─────────────────────────────────────────────────────────────────────────────

export async function salvarComodidades(
  embarcacaoId: string,
  comodidadeIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (comodidadeIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', user.id)
    .single();

  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

  const rows = comodidadeIds.map(comodidade_id => ({
    embarcacao_id: embarcacaoId,
    comodidade_id,
  }));

  const { error } = await supabaseAdmin
    .from('embarcacao_comodidades')
    .insert(rows);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: buscar todos os equipamentos de segurança disponíveis
// ─────────────────────────────────────────────────────────────────────────────

export async function getEquipamentosSeguranca(): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabaseAdmin
    .from('equipamentos_seguranca')
    .select('id, nome')
    .order('nome');

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: salvar equipamentos de segurança vinculados a uma embarcação
// ─────────────────────────────────────────────────────────────────────────────

export async function salvarEquipamentosSeguranca(
  embarcacaoId: string,
  equipamentoIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (equipamentoIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', user.id)
    .single();

  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

  const rows = equipamentoIds.map(equipamento_seguranca_id => ({
    embarcacao_id: embarcacaoId,
    equipamento_seguranca_id,
  }));

  const { error } = await supabaseAdmin
    .from('embarcacao_equipamentos_seguranca')
    .insert(rows);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: listar acessórios disponíveis
// ─────────────────────────────────────────────────────────────────────────────

export async function getAcessorios(): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabaseAdmin
    .from('acessorios')
    .select('id, nome')
    .order('nome');

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: salvar acessórios vinculados a uma embarcação
// ─────────────────────────────────────────────────────────────────────────────

export async function salvarAcessorios(
  embarcacaoId: string,
  acessorioIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (acessorioIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', user.id)
    .single();

  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

  const rows = acessorioIds.map(acessorio_id => ({
    embarcacao_id: embarcacaoId,
    acessorio_id,
  }));

  const { error } = await supabaseAdmin
    .from('embarcacao_acessorios')
    .insert(rows);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
