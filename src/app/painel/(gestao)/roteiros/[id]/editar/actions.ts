'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { buildKeyFromUrl, deleteFromR2 } from '@/lib/r2';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AtualizarRoteiroPayload = {
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

type ActionResult = { ok: boolean; error?: string };

// ─── Helper de autenticação + ownership ──────────────────────────────────────

async function getAuthorizedUser(roteiroId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { error: 'Acesso não autorizado.' };

  // Admin pode editar qualquer roteiro; gestor apenas os próprios.
  const isAdmin = await checkRoleInDb(user.id, ['admin']);

  let query = supabaseAdmin
    .from('roteiro')
    .select('id')
    .eq('id', roteiroId);
  if (!isAdmin) query = query.eq('owner_id', user.id);

  const { data: roteiro } = await query.single();
  if (!roteiro) return { error: 'Roteiro não encontrado ou sem permissão.' };

  return { userId: user.id, ok: true as const };
}

// ─── Action: atualizar roteiro ────────────────────────────────────────────────

export async function atualizarRoteiro(
  roteiroId: string,
  payload: AtualizarRoteiroPayload,
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  if (!payload.nome.trim())      return { ok: false, error: 'O nome do roteiro é obrigatório.' };
  if (!payload.descricao.trim()) return { ok: false, error: 'A descrição do roteiro é obrigatória.' };

  const { error } = await supabaseAdmin
    .from('roteiro')
    .update({
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
    .eq('id', roteiroId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: salvar datas bloqueadas (disponibilidade) ───────────────────────

export async function salvarBloqueiosRoteiro(
  roteiroId: string,
  datas: string[],
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

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

// ─── Action: excluir imagem de roteiro ───────────────────────────────────────

export async function excluirImagemRoteiro(
  roteiroId: string,
  imagemId: string,
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  const { data: imagem } = await supabaseAdmin
    .from('roteiro_imagens')
    .select('url_imagem')
    .eq('id', imagemId)
    .eq('roteiro_id', roteiroId)
    .single();

  if (imagem?.url_imagem) {
    const key = buildKeyFromUrl(imagem.url_imagem);
    await deleteFromR2(key).catch(() => null);
  }

  const { error } = await supabaseAdmin
    .from('roteiro_imagens')
    .delete()
    .eq('id', imagemId)
    .eq('roteiro_id', roteiroId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: excluir regra de preço ──────────────────────────────────────────

export async function excluirRegraRoteiro(
  roteiroId: string,
  regraId: string,
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  const { error } = await supabaseAdmin
    .from('roteiro_preco_regra')
    .delete()
    .eq('id', regraId)
    .eq('roteiro_id', roteiroId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Action: substituir itens do catálogo vinculados ao roteiro ──────────────

export type ItemCatalogoRoteiro = {
  catalogoId: string;
  valorCustomizado: number | null;
};

export async function atualizarCatalogoRoteiro(
  roteiroId: string,
  itens: ItemCatalogoRoteiro[],
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  // Exclui todos os vínculos anteriores e recria
  await supabaseAdmin.from('roteiro_catalogo').delete().eq('roteiro_id', roteiroId);

  if (itens.length > 0) {
    const rows = itens.map(i => ({
      roteiro_id:        roteiroId,
      catalogo_id:       i.catalogoId,
      valor_customizado: i.valorCustomizado,
    }));
    const { error } = await supabaseAdmin.from('roteiro_catalogo').insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ─── Action: definir imagem principal ────────────────────────────────────────

export async function definirPrincipalRoteiro(
  roteiroId: string,
  imagemId: string,
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  await supabaseAdmin
    .from('roteiro_imagens')
    .update({ principal: false })
    .eq('roteiro_id', roteiroId);

  const { error } = await supabaseAdmin
    .from('roteiro_imagens')
    .update({ principal: true })
    .eq('id', imagemId)
    .eq('roteiro_id', roteiroId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
