'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { EmbarcacaoStatus, ModalidadeCapitao, PrecoRegraTipo } from '@/types/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type CriarEmbarcacaoPayload = {
  nome: string;
  descricao: string;
  embarcacao_tipo_id: string;
  embarcacao_categoria_id: string;
  status: EmbarcacaoStatus;
  modalidade_capitao: ModalidadeCapitao;
  capacidade: string;
  comprimento: string;
  cabines: string;
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

export type CriarEmbarcacaoResult =
  | { ok: true; embarcacaoId: string; ownerId: string }
  | { ok: false; error: string };

export type SalvarImagemPayload = {
  embarcacaoId: string;
  urlImagem: string;
  titulo?: string;
  principal: boolean;
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

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  const { data, error } = await supabaseAdmin
    .from('embarcacao')
    .insert({
      owner_id: user.id,
      nome: payload.nome.trim(),
      descricao: payload.descricao.trim() || null,
      embarcacao_tipo_id: payload.embarcacao_tipo_id || null,
      embarcacao_categoria_id: payload.embarcacao_categoria_id || null,
      status: payload.status,
      modalidade_capitao: payload.modalidade_capitao,
      capacidade: payload.capacidade ? parseInt(payload.capacidade, 10) : null,
      comprimento: payload.comprimento ? parseFloat(payload.comprimento) : null,
      cabines: payload.cabines ? parseInt(payload.cabines, 10) : null,
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
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Erro ao salvar embarcação.' };
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

  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', payload.embarcacaoId)
    .eq('owner_id', user.id)
    .single();

  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

  if (payload.principal) {
    await supabaseAdmin
      .from('embarcacao_imagens')
      .update({ principal: false })
      .eq('embarcacao_id', payload.embarcacaoId);
  }

  const { error } = await supabaseAdmin.from('embarcacao_imagens').insert({
    embarcacao_id: payload.embarcacaoId,
    url_imagem: payload.urlImagem,
    titulo: payload.titulo ?? null,
    principal: payload.principal,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: criar regra de preço vinculada a uma embarcação
// ─────────────────────────────────────────────────────────────────────────────

export type CriarRegraPayload = {
  embarcacaoId: string;
  nome: string;
  valor: number;
  tipo: PrecoRegraTipo;
  prioridade: number;
  diasSemana?: number[];
  periodoMesInicio?: number;
  periodoDiaInicio?: number;
  periodoMesFim?: number;
  periodoDiaFim?: number;
  dataInicio?: string;
  dataFim?: string;
};

export async function criarRegra(
  payload: CriarRegraPayload,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { error } = await supabaseAdmin.from('embarcacao_preco_regra').insert({
    embarcacao_id: payload.embarcacaoId,
    nome: payload.nome,
    valor: payload.valor,
    tipo: payload.tipo,
    prioridade: payload.prioridade,
    ativo: true,
    dias_semana: payload.diasSemana ?? null,
    periodo_mes_inicio: payload.periodoMesInicio ?? null,
    periodo_dia_inicio: payload.periodoDiaInicio ?? null,
    periodo_mes_fim: payload.periodoMesFim ?? null,
    periodo_dia_fim: payload.periodoDiaFim ?? null,
    data_inicio: payload.dataInicio ?? null,
    data_fim: payload.dataFim ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: salvar datas bloqueadas (disponibilidade)
// ─────────────────────────────────────────────────────────────────────────────

export async function salvarBloqueiosEmbarcacao(
  embarcacaoId: string,
  datas: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: embarcacao } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', embarcacaoId)
    .eq('owner_id', user.id)
    .single();

  if (!embarcacao) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

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
