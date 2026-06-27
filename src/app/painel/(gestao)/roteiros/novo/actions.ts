'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { PrecoRegraTipo } from '@/types/supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type CriarRoteiroPayload = {
  embarcacao_id: string;
  nome: string;
  descricao: string;
  duracao: string;
  quantidade_pessoas: string;
  origem: string;
  destino: string;
  municipio_id: string;
  preco_base: string;
  latitude: string;
  longitude: string;
  cep: string;
  bairro: string;
  logradouro: string;
  logradouro_numero: string;
  complemento: string;
  /** Dias da semana em que o roteiro opera (0=Dom..6=Sáb). Vazio = todos os dias. */
  disponibilidade_dias_semana: number[];
};

export type CriarRegraRoteiroPayload = {
  roteiroId: string;
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

export type CriarRoteiroResult =
  | { ok: true; roteiroId: string; ownerId: string }
  | { ok: false; error: string };

export type SalvarImagemRoteiroPayload = {
  roteiroId: string;
  urlImagem: string;
  titulo?: string;
  principal: boolean;
};

// ─── Action: criar roteiro ────────────────────────────────────────────────────

export async function criarRoteiro(
  payload: CriarRoteiroPayload,
): Promise<CriarRoteiroResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  if (!payload.nome.trim())    return { ok: false, error: 'O nome do roteiro é obrigatório.' };
  if (!payload.descricao.trim()) return { ok: false, error: 'A descrição do roteiro é obrigatória.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  const { data, error } = await supabaseAdmin
    .from('roteiro')
    .insert({
      owner_id:           user.id,
      embarcacao_id:      payload.embarcacao_id || null,
      nome:               payload.nome.trim(),
      descricao:          payload.descricao.trim(),
      preco_base:         payload.preco_base ? parseFloat(payload.preco_base) : null,
      duracao:            payload.duracao.trim() || null,
      quantidade_pessoas: payload.quantidade_pessoas ? parseInt(payload.quantidade_pessoas, 10) : null,
      origem:             payload.origem.trim() || null,
      destino:            payload.destino.trim() || null,
      municipio_id:       payload.municipio_id ? parseInt(payload.municipio_id, 10) : null,
      latitude:           payload.latitude  ? parseFloat(payload.latitude)  : null,
      longitude:          payload.longitude ? parseFloat(payload.longitude) : null,
      cep:                payload.cep.replace(/\D/g, '') || null,
      bairro:             payload.bairro.trim() || null,
      logradouro:         payload.logradouro.trim() || null,
      logradouro_numero:  payload.logradouro_numero.trim() || null,
      complemento:        payload.complemento.trim() || null,
      disponibilidade_dias_semana:
        payload.disponibilidade_dias_semana.length > 0 ? payload.disponibilidade_dias_semana : null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Erro ao salvar roteiro.' };
  }

  return { ok: true, roteiroId: data.id, ownerId: user.id };
}

// ─── Action: salvar imagem de roteiro após upload no R2 ──────────────────────

export async function salvarImagemRoteiro(
  payload: SalvarImagemRoteiroPayload,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: roteiro } = await supabaseAdmin
    .from('roteiro')
    .select('id')
    .eq('id', payload.roteiroId)
    .eq('owner_id', user.id)
    .single();

  if (!roteiro) return { ok: false, error: 'Roteiro não encontrado ou sem permissão.' };

  if (payload.principal) {
    await supabaseAdmin
      .from('roteiro_imagens')
      .update({ principal: false })
      .eq('roteiro_id', payload.roteiroId);
  }

  const { error } = await supabaseAdmin.from('roteiro_imagens').insert({
    roteiro_id: payload.roteiroId,
    url_imagem: payload.urlImagem,
    titulo:     payload.titulo ?? null,
    principal:  payload.principal,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: criar regra de preço vinculada a um roteiro ─────────────────────

export async function criarRegraRoteiro(
  payload: CriarRegraRoteiroPayload,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { error } = await supabaseAdmin.from('roteiro_preco_regra').insert({
    roteiro_id:         payload.roteiroId,
    nome:               payload.nome,
    valor:              payload.valor,
    tipo:               payload.tipo,
    prioridade:         payload.prioridade,
    ativo:              true,
    dias_semana:        payload.diasSemana        ?? null,
    periodo_mes_inicio: payload.periodoMesInicio  ?? null,
    periodo_dia_inicio: payload.periodoDiaInicio  ?? null,
    periodo_mes_fim:    payload.periodoMesFim     ?? null,
    periodo_dia_fim:    payload.periodoDiaFim     ?? null,
    data_inicio:        payload.dataInicio        ?? null,
    data_fim:           payload.dataFim           ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: salvar itens do catálogo vinculados ao roteiro ──────────────────

export type ItemCatalogoRoteiro = {
  catalogoId: string;
  valorCustomizado: number | null;
};

export async function salvarCatalogoRoteiro(
  roteiroId: string,
  itens: ItemCatalogoRoteiro[],
): Promise<{ ok: boolean; error?: string }> {
  if (itens.length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const rows = itens.map(i => ({
    roteiro_id:        roteiroId,
    catalogo_id:       i.catalogoId,
    valor_customizado: i.valorCustomizado,
  }));

  const { error } = await supabaseAdmin.from('roteiro_catalogo').insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: salvar datas bloqueadas (disponibilidade) ───────────────────────

export async function salvarBloqueiosRoteiro(
  roteiroId: string,
  datas: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: roteiro } = await supabaseAdmin
    .from('roteiro')
    .select('id')
    .eq('id', roteiroId)
    .eq('owner_id', user.id)
    .single();

  if (!roteiro) return { ok: false, error: 'Roteiro não encontrado ou sem permissão.' };

  // Substitui o conjunto de bloqueios pelo informado.
  await supabaseAdmin
    .from('roteiro_disponibilidade_bloqueio')
    .delete()
    .eq('roteiro_id', roteiroId);

  if (datas.length === 0) return { ok: true };

  const rows = datas.map(data => ({ roteiro_id: roteiroId, data }));
  const { error } = await supabaseAdmin
    .from('roteiro_disponibilidade_bloqueio')
    .insert(rows);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: buscar municípios por estado ─────────────────────────────────────

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
