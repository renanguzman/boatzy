'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

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
  latitude: string;
  longitude: string;
  cep: string;
  bairro: string;
  logradouro: string;
  logradouro_numero: string;
  complemento: string;
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
