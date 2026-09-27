'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { buildKeyFromUrl, deleteFromR2 } from '@/lib/r2';
import { duracaoParaHoras, duracaoTexto, type DuracaoUnidade } from '@/lib/duracao';
import type { PrecoPessoaModoCapacidade } from '@/types/supabase';
import { normalizarTituloImagem } from '@/lib/galeria';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AtualizarRoteiroPayload = {
  embarcacao_id: string;
  nome: string;
  descricao: string;
  /** Duração: número digitado + unidade — vira `duracao_horas` (busca) e `duracao` (rótulo). */
  duracao_valor: string;
  duracao_unidade: DuracaoUnidade;
  quantidade_pessoas: string;
  origem: string;
  destino: string;
  municipio_id: string;
  preco_base: string;
  /** Modelo "Por Diária": passeio de vários dias, cobrado por diária. */
  preco_diaria_ativo: boolean;
  preco_diaria_valor: string;
  preco_diaria_minimo: string;
  /** Modelo "Por Pessoa": bilheteria, valor fixo por pessoa. */
  preco_pessoa_ativo: boolean;
  preco_pessoa_valor: string;
  preco_pessoa_capacidade_minima: string;
  preco_pessoa_capacidade_maxima: string;
  preco_pessoa_modo_capacidade: PrecoPessoaModoCapacidade;
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
  if (payload.preco_diaria_ativo && !payload.preco_diaria_valor) {
    return { ok: false, error: 'Informe o valor da diária no modelo "Por Diária".' };
  }
  if (payload.preco_pessoa_ativo && !payload.preco_pessoa_valor) {
    return { ok: false, error: 'Informe o valor por pessoa no modelo "Por Pessoa".' };
  }
  if (payload.preco_pessoa_ativo && !payload.preco_pessoa_capacidade_maxima) {
    return { ok: false, error: 'Informe a capacidade máxima no modelo "Por Pessoa".' };
  }

  // O rótulo exibido é derivado do par (valor, unidade) — nunca digitado à mão,
  // para que texto e número nunca divirjam.
  const duracaoHoras = duracaoParaHoras(payload.duracao_valor, payload.duracao_unidade);

  const { error } = await supabaseAdmin
    .from('roteiro')
    .update({
      embarcacao_id:      payload.embarcacao_id || null,
      nome:               payload.nome.trim(),
      descricao:          payload.descricao.trim(),
      preco_base:         payload.preco_base ? parseFloat(payload.preco_base) : null,
      preco_diaria_ativo: payload.preco_diaria_ativo,
      preco_diaria_valor: payload.preco_diaria_ativo && payload.preco_diaria_valor
        ? parseFloat(payload.preco_diaria_valor) : null,
      preco_diaria_minimo: Math.max(1, parseInt(payload.preco_diaria_minimo, 10) || 1),
      preco_pessoa_ativo: payload.preco_pessoa_ativo,
      preco_pessoa_valor: payload.preco_pessoa_ativo && payload.preco_pessoa_valor
        ? parseFloat(payload.preco_pessoa_valor) : null,
      preco_pessoa_capacidade_minima: payload.preco_pessoa_capacidade_minima
        ? parseInt(payload.preco_pessoa_capacidade_minima, 10) : null,
      preco_pessoa_capacidade_maxima: payload.preco_pessoa_ativo && payload.preco_pessoa_capacidade_maxima
        ? parseInt(payload.preco_pessoa_capacidade_maxima, 10) : null,
      preco_pessoa_modo_capacidade: payload.preco_pessoa_modo_capacidade,
      duracao:            duracaoTexto(duracaoHoras),
      duracao_horas:      duracaoHoras,
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

// ─── Action: salvar paradas do itinerário (pontos entre origem e destino) ────

export async function salvarParadasRoteiro(
  roteiroId: string,
  paradas: string[],
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  // Substitui o conjunto de paradas pelo informado, preservando a ordem.
  await supabaseAdmin
    .from('roteiro_parada')
    .delete()
    .eq('roteiro_id', roteiroId);

  const nomes = paradas.map(p => p.trim()).filter(Boolean);
  if (nomes.length === 0) return { ok: true };

  const rows = nomes.map((nome, i) => ({ roteiro_id: roteiroId, ordem: i, nome }));
  const { error } = await supabaseAdmin.from('roteiro_parada').insert(rows);

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

// ─── Action: atualizar título, ordem e principal das imagens salvas ─────────

export type ImagemGaleriaUpdate = { id: string; titulo: string; ordem: number; principal: boolean };

/**
 * Grava a galeria editada no `GaleriaImagensEditor` para as imagens que já
 * existiam: título, posição e qual é a principal. Imagens novas são inseridas
 * depois via upload (com a própria `ordem`).
 */
export async function atualizarImagensRoteiro(
  roteiroId: string,
  imagens: ImagemGaleriaUpdate[],
): Promise<ActionResult> {
  const result = await getAuthorizedUser(roteiroId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  // Zera a principal antes para nunca existirem duas ao mesmo tempo.
  if (imagens.some(i => i.principal)) {
    await supabaseAdmin.from('roteiro_imagens').update({ principal: false }).eq('roteiro_id', roteiroId);
  }

  const results = await Promise.all(imagens.map(img =>
    supabaseAdmin
      .from('roteiro_imagens')
      .update({
        titulo: normalizarTituloImagem(img.titulo),
        ordem: Math.max(0, Math.trunc(img.ordem)),
        principal: img.principal,
      })
      .eq('id', img.id)
      .eq('roteiro_id', roteiroId),
  ));

  const falha = results.find(r => r.error);
  if (falha?.error) return { ok: false, error: falha.error.message };
  return { ok: true };
}
