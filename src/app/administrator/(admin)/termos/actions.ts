'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { isTermoIdentificador } from '@/lib/termos/identificadores';

type ActionResult = { ok: boolean; error?: string };
type AdminAuth = { ok: true; userId: string } | { ok: false; error: string };

async function requireAdmin(): Promise<AdminAuth> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };

  return { ok: true, userId: user.id };
}

export type TermoPayload = {
  identificador: string;
  titulo: string;
  conteudo: string;
  descricaoInterna: string;
  exigeRolagemCompleta: boolean;
  exigeConfirmacaoDigitada: boolean;
};

type CriarResult = { ok: true; termoId: string } | { ok: false; error: string };

const ERRO_RASCUNHO_EXISTENTE =
  'Já existe um rascunho em andamento para este termo — edite-o ou exclua-o antes de criar outro.';

/** Validação comum a criar/atualizar. Retorna mensagem de erro ou null. */
function validarPayload(payload: TermoPayload): string | null {
  if (!isTermoIdentificador(payload.identificador)) return 'Selecione um identificador válido.';
  if (!payload.titulo.trim()) return 'O título é obrigatório.';
  if (!payload.conteudo.trim()) return 'O conteúdo do termo é obrigatório.';
  return null;
}

function montarCampos(payload: TermoPayload) {
  return {
    titulo: payload.titulo.trim(),
    conteudo: payload.conteudo.trim(),
    descricao_interna: payload.descricaoInterna.trim() || null,
    exige_rolagem_completa: payload.exigeRolagemCompleta,
    exige_confirmacao_digitada: payload.exigeConfirmacaoDigitada,
  };
}

function revalidar(termoId?: string) {
  revalidatePath('/administrator/termos');
  if (termoId) revalidatePath(`/administrator/termos/${termoId}`);
}

/**
 * Cria um rascunho. A versão é atribuída pelo banco (próxima do identificador),
 * então "novo termo" para um identificador que já tem versão publicada é,
 * na prática, a próxima versão dele.
 */
export async function criarTermo(payload: TermoPayload): Promise<CriarResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const { data, error } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .insert({ ...montarCampos(payload), identificador: payload.identificador, criado_por: auth.userId })
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: ERRO_RASCUNHO_EXISTENTE };
    return { ok: false, error: error?.message ?? 'Erro ao salvar o termo.' };
  }

  revalidar();
  return { ok: true, termoId: data.id };
}

/** Atualiza um rascunho. Versões publicadas/arquivadas são recusadas pelo trigger do banco. */
export async function atualizarTermo(termoId: string, payload: TermoPayload): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const erroValidacao = validarPayload(payload);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const { data, error } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .update(montarCampos(payload))
    .eq('id', termoId)
    .eq('status', 'rascunho')
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Somente rascunhos podem ser editados — crie uma nova versão.' };

  revalidar(termoId);
  return { ok: true };
}

/**
 * Publica um rascunho: arquiva a versão vigente do mesmo identificador e
 * torna esta a vigente, atomicamente (RPC). O banco carimba a data e
 * calcula o hash SHA-256 do texto — a partir daqui o texto é imutável.
 */
export async function publicarTermo(termoId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await supabaseAdmin.rpc('publicar_termo_uso', {
    p_termo_id: termoId,
    p_publicado_por: auth.userId,
  });

  if (error) return { ok: false, error: error.message };

  revalidar(termoId);
  return { ok: true };
}

/** Cria um rascunho a partir de uma versão existente (única forma de "editar" um termo publicado). */
export async function criarNovaVersao(termoId: string): Promise<CriarResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: origem } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .select('identificador, titulo, conteudo, descricao_interna, exige_rolagem_completa, exige_confirmacao_digitada')
    .eq('id', termoId)
    .single();

  if (!origem) return { ok: false, error: 'Termo não encontrado.' };

  const { data, error } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .insert({ ...origem, criado_por: auth.userId })
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: ERRO_RASCUNHO_EXISTENTE };
    return { ok: false, error: error?.message ?? 'Erro ao criar nova versão.' };
  }

  revalidar();
  return { ok: true, termoId: data.id };
}

/**
 * Retira de vigência a versão publicada SEM substituí-la. Os pontos do
 * sistema que exigem esse termo ficam sem texto vigente até uma nova publicação.
 */
export async function arquivarTermo(termoId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data, error } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .update({ status: 'arquivado' })
    .eq('id', termoId)
    .eq('status', 'publicado')
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Somente a versão vigente pode ser arquivada.' };

  revalidar(termoId);
  return { ok: true };
}

/** Exclui um rascunho. Versões publicadas/arquivadas são recusadas pelo trigger do banco. */
export async function excluirTermo(termoId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data, error } = await supabaseAdmin
    .from('termos_uso_plataforma')
    .delete()
    .eq('id', termoId)
    .eq('status', 'rascunho')
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Somente rascunhos podem ser excluídos.' };

  revalidar();
  return { ok: true };
}
