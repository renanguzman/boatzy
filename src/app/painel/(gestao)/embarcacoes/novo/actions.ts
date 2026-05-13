'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { EmbarcacaoStatus, PrecoRegraTipo } from '@/types/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type CriarEmbarcacaoPayload = {
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
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: 'Não autenticado.' };

  if (!payload.nome.trim()) {
    return { ok: false, error: 'O nome da embarcação é obrigatório.' };
  }

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkId)
    .single();

  if (!dbUser) return { ok: false, error: 'Usuário não encontrado.' };

  const autorizado = await checkRoleInDb(dbUser.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  const { data, error } = await supabaseAdmin
    .from('embarcacao')
    .insert({
      owner_id: dbUser.id,
      nome: payload.nome.trim(),
      descricao: payload.descricao.trim() || null,
      embarcacao_tipo_id:      payload.embarcacao_tipo_id      || null,
      embarcacao_categoria_id: payload.embarcacao_categoria_id || null,
      status: payload.status,
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
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Erro ao salvar embarcação.' };
  }

  return { ok: true, embarcacaoId: data.id, ownerId: dbUser.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action: salvar registro de imagem após upload no R2
// ─────────────────────────────────────────────────────────────────────────────

export async function salvarImagem(payload: SalvarImagemPayload): Promise<{ ok: boolean; error?: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: 'Não autenticado.' };

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkId)
    .single();

  if (!dbUser) return { ok: false, error: 'Usuário não encontrado.' };

  // Verifica que a embarcação pertence ao usuário
  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('id', payload.embarcacaoId)
    .eq('owner_id', dbUser.id)
    .single();

  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };

  // Se esta será a principal, remove principal das outras
  if (payload.principal) {
    await supabaseAdmin
      .from('embarcacao_imagens')
      .update({ principal: false })
      .eq('embarcacao_id', payload.embarcacaoId);
  }

  const { error } = await supabaseAdmin.from('embarcacao_imagens').insert({
    embarcacao_id: payload.embarcacaoId,
    url_imagem:   payload.urlImagem,
    titulo:       payload.titulo ?? null,
    principal:    payload.principal,
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
  // dia_semana
  diasSemana?: number[];
  // periodo_anual
  periodoMesInicio?: number;
  periodoDiaInicio?: number;
  periodoMesFim?: number;
  periodoDiaFim?: number;
  // data_fixa
  dataInicio?: string;
  dataFim?: string;
};

export async function criarRegra(
  payload: CriarRegraPayload,
): Promise<{ ok: boolean; error?: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: 'Não autenticado.' };

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkId)
    .single();

  if (!dbUser) return { ok: false, error: 'Usuário não encontrado.' };

  const { error } = await supabaseAdmin.from('embarcacao_preco_regra').insert({
    embarcacao_id: payload.embarcacaoId,
    nome:          payload.nome,
    valor:         payload.valor,
    tipo:          payload.tipo,
    prioridade:    payload.prioridade,
    ativo:         true,
    dias_semana:        payload.diasSemana       ?? null,
    periodo_mes_inicio: payload.periodoMesInicio ?? null,
    periodo_dia_inicio: payload.periodoDiaInicio ?? null,
    periodo_mes_fim:    payload.periodoMesFim    ?? null,
    periodo_dia_fim:    payload.periodoDiaFim    ?? null,
    data_inicio:        payload.dataInicio       ?? null,
    data_fim:           payload.dataFim          ?? null,
  });

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
