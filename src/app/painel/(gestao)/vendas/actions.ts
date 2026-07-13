'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { AnuncioVendaStatus } from '@/types/supabase';

type ActionResult = { ok: boolean; error?: string };
type CriarResult = { ok: true; anuncioId: string } | { ok: false; error: string };

export type AnuncioPayload = {
  embarcacaoId: string;
  fabricante: string;
  anoModelo: string;
  anoFabricacao: string;
  preco: string;
  descricaoVenda: string;
  /** Obrigatório apenas quando a embarcação ainda não tem tipo (grava na embarcação). */
  tipoId?: string;
};

const ANO_MIN = 1900;
const anoMax = () => new Date().getFullYear() + 1;

function validarCampos(payload: Omit<AnuncioPayload, 'embarcacaoId' | 'tipoId'>): string | null {
  if (!payload.fabricante.trim()) return 'O fabricante é obrigatório.';

  const anoModelo = parseInt(payload.anoModelo, 10);
  const anoFabricacao = parseInt(payload.anoFabricacao, 10);
  if (!Number.isInteger(anoModelo) || anoModelo < ANO_MIN || anoModelo > anoMax()) {
    return `O ano do modelo deve estar entre ${ANO_MIN} e ${anoMax()}.`;
  }
  if (!Number.isInteger(anoFabricacao) || anoFabricacao < ANO_MIN || anoFabricacao > anoMax()) {
    return `O ano de fabricação deve estar entre ${ANO_MIN} e ${anoMax()}.`;
  }

  const preco = parseFloat(payload.preco);
  if (!payload.preco || !Number.isFinite(preco) || preco <= 0) {
    return 'O valor do anúncio é obrigatório e deve ser maior que zero.';
  }
  return null;
}

async function getGestor(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { error: 'Acesso não autorizado.' };

  return { userId: user.id };
}

/**
 * Cria um anúncio de venda aproveitando uma embarcação do gestor.
 * Grava o primeiro registro do histórico de preço junto. Se a
 * embarcação não tem tipo, exige `tipoId` e grava na própria
 * embarcação (o filtro de busca por tipo é obrigatório).
 */
export async function criarAnuncio(payload: AnuncioPayload): Promise<CriarResult> {
  const gestor = await getGestor();
  if ('error' in gestor) return { ok: false, error: gestor.error };

  const invalido = validarCampos(payload);
  if (invalido) return { ok: false, error: invalido };

  // Posse + estado da embarcação.
  const { data: emb } = await supabaseAdmin
    .from('embarcacao')
    .select('id, status, embarcacao_tipo_id')
    .eq('id', payload.embarcacaoId)
    .eq('owner_id', gestor.userId)
    .single();

  if (!emb) return { ok: false, error: 'Embarcação não encontrada ou sem permissão.' };
  if (emb.status !== 'ativo') {
    return { ok: false, error: 'A embarcação precisa estar ativa para ser anunciada.' };
  }

  if (!emb.embarcacao_tipo_id) {
    if (!payload.tipoId) {
      return { ok: false, error: 'A embarcação não tem tipo — selecione um para anunciar.' };
    }
    const { error } = await supabaseAdmin
      .from('embarcacao')
      .update({ embarcacao_tipo_id: payload.tipoId })
      .eq('id', emb.id);
    if (error) return { ok: false, error: error.message };
  }

  const preco = parseFloat(payload.preco);
  const { data: anuncio, error } = await supabaseAdmin
    .from('anuncio_venda')
    .insert({
      embarcacao_id: emb.id,
      owner_id: gestor.userId,
      fabricante: payload.fabricante.trim(),
      ano_modelo: parseInt(payload.anoModelo, 10),
      ano_fabricacao: parseInt(payload.anoFabricacao, 10),
      preco,
      descricao_venda: payload.descricaoVenda.trim() || null,
    })
    .select('id')
    .single();

  if (error || !anuncio) {
    // 23505 = UNIQUE parcial de anúncio vigente por embarcação.
    if (error?.code === '23505') {
      return { ok: false, error: 'Esta embarcação já possui um anúncio vigente.' };
    }
    return { ok: false, error: error?.message ?? 'Erro ao criar o anúncio.' };
  }

  await supabaseAdmin
    .from('anuncio_venda_preco')
    .insert({ anuncio_id: anuncio.id, preco });

  revalidatePath('/painel/vendas');
  return { ok: true, anuncioId: anuncio.id };
}

/**
 * Atualiza os campos de venda do anúncio (a embarcação vinculada não muda).
 * Alteração de preço gera novo registro no histórico — é ele que
 * alimenta o selo "Preço reduzido" no site.
 */
export async function atualizarAnuncio(
  anuncioId: string,
  payload: Omit<AnuncioPayload, 'embarcacaoId'>,
): Promise<ActionResult> {
  const gestor = await getGestor();
  if ('error' in gestor) return { ok: false, error: gestor.error };

  const invalido = validarCampos(payload);
  if (invalido) return { ok: false, error: invalido };

  const { data: anuncio } = await supabaseAdmin
    .from('anuncio_venda')
    .select('id, preco, status, embarcacao_id')
    .eq('id', anuncioId)
    .eq('owner_id', gestor.userId)
    .single();

  if (!anuncio) return { ok: false, error: 'Anúncio não encontrado ou sem permissão.' };
  if (anuncio.status === 'vendido' || anuncio.status === 'cancelado') {
    return { ok: false, error: 'Anúncios encerrados não podem ser editados.' };
  }

  if (payload.tipoId) {
    const { error } = await supabaseAdmin
      .from('embarcacao')
      .update({ embarcacao_tipo_id: payload.tipoId })
      .eq('id', anuncio.embarcacao_id);
    if (error) return { ok: false, error: error.message };
  }

  const preco = parseFloat(payload.preco);
  const { error } = await supabaseAdmin
    .from('anuncio_venda')
    .update({
      fabricante: payload.fabricante.trim(),
      ano_modelo: parseInt(payload.anoModelo, 10),
      ano_fabricacao: parseInt(payload.anoFabricacao, 10),
      preco,
      descricao_venda: payload.descricaoVenda.trim() || null,
    })
    .eq('id', anuncioId);

  if (error) return { ok: false, error: error.message };

  if (preco !== Number(anuncio.preco)) {
    await supabaseAdmin
      .from('anuncio_venda_preco')
      .insert({ anuncio_id: anuncioId, preco });
  }

  revalidatePath('/painel/vendas');
  revalidatePath(`/painel/vendas/${anuncioId}/editar`);
  return { ok: true };
}

/**
 * Ciclo de vida do anúncio: ativo ↔ pausado; vendido/cancelado são
 * terminais (liberam a embarcação para um novo anúncio, preservando
 * histórico e leads — não há exclusão).
 */
export async function alterarStatusAnuncio(
  anuncioId: string,
  novoStatus: AnuncioVendaStatus,
): Promise<ActionResult> {
  const gestor = await getGestor();
  if ('error' in gestor) return { ok: false, error: gestor.error };

  const { data: anuncio } = await supabaseAdmin
    .from('anuncio_venda')
    .select('id, status')
    .eq('id', anuncioId)
    .eq('owner_id', gestor.userId)
    .single();

  if (!anuncio) return { ok: false, error: 'Anúncio não encontrado ou sem permissão.' };
  if (anuncio.status === 'vendido' || anuncio.status === 'cancelado') {
    return { ok: false, error: 'Anúncios encerrados não mudam de status — crie um novo anúncio.' };
  }

  const { error } = await supabaseAdmin
    .from('anuncio_venda')
    .update({ status: novoStatus })
    .eq('id', anuncioId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel/vendas');
  return { ok: true };
}
