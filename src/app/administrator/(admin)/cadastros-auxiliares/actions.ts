'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

type ActionResult = { ok: boolean; error?: string; vinculos?: number };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };

  return { ok: true };
}

/** Normaliza (trim) e valida o nome digitado — comum às 3 entidades. */
function validarNome(nome: string): { ok: true; nome: string } | { ok: false; error: string } {
  const limpo = nome.trim();
  if (!limpo) return { ok: false, error: 'Informe um nome.' };
  if (limpo.length > 80) return { ok: false, error: 'Nome muito longo (máximo 80 caracteres).' };
  return { ok: true, nome: limpo };
}

function erroDuplicado(code: string | undefined, artigo: string, nomeExibicao: string): string | null {
  if (code !== '23505') return null;
  return `Já existe ${artigo} ${nomeExibicao} com esse nome.`;
}

// ─── Acessórios ───────────────────────────────────────────────────────────────

export async function criarAcessorio(nome: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const nomeResult = validarNome(nome);
  if (!nomeResult.ok) return { ok: false, error: nomeResult.error };

  const { error } = await supabaseAdmin.from('acessorios').insert({ nome: nomeResult.nome });
  if (error) return { ok: false, error: erroDuplicado(error.code, 'um', 'acessório') ?? error.message };
  return { ok: true };
}

export async function atualizarAcessorio(id: string, nome: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const nomeResult = validarNome(nome);
  if (!nomeResult.ok) return { ok: false, error: nomeResult.error };

  const { error } = await supabaseAdmin.from('acessorios').update({ nome: nomeResult.nome }).eq('id', id);
  if (error) return { ok: false, error: erroDuplicado(error.code, 'um', 'acessório') ?? error.message };
  return { ok: true };
}

/**
 * Exclui, avisando antes se o acessório está vinculado a alguma embarcação —
 * a ligação é `ON DELETE CASCADE`, então excluir aqui também remove o vínculo
 * de todas as embarcações que o tinham marcado. Sem `confirmado`, para na
 * contagem; o client decide se confirma de novo.
 */
export async function excluirAcessorio(id: string, confirmado = false): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!confirmado) {
    const { count } = await supabaseAdmin
      .from('embarcacao_acessorios')
      .select('id', { count: 'exact', head: true })
      .eq('acessorio_id', id);
    if ((count ?? 0) > 0) return { ok: false, error: 'EM_USO', vinculos: count ?? 0 };
  }

  const { error } = await supabaseAdmin.from('acessorios').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Comodidades ──────────────────────────────────────────────────────────────

export async function criarComodidade(nome: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const nomeResult = validarNome(nome);
  if (!nomeResult.ok) return { ok: false, error: nomeResult.error };

  const { error } = await supabaseAdmin.from('comodidade').insert({ nome: nomeResult.nome });
  if (error) return { ok: false, error: erroDuplicado(error.code, 'uma', 'comodidade') ?? error.message };
  return { ok: true };
}

export async function atualizarComodidade(id: string, nome: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const nomeResult = validarNome(nome);
  if (!nomeResult.ok) return { ok: false, error: nomeResult.error };

  const { error } = await supabaseAdmin.from('comodidade').update({ nome: nomeResult.nome }).eq('id', id);
  if (error) return { ok: false, error: erroDuplicado(error.code, 'uma', 'comodidade') ?? error.message };
  return { ok: true };
}

export async function excluirComodidade(id: string, confirmado = false): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!confirmado) {
    const { count } = await supabaseAdmin
      .from('embarcacao_comodidades')
      .select('id', { count: 'exact', head: true })
      .eq('comodidade_id', id);
    if ((count ?? 0) > 0) return { ok: false, error: 'EM_USO', vinculos: count ?? 0 };
  }

  const { error } = await supabaseAdmin.from('comodidade').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Equipamentos de segurança ────────────────────────────────────────────────

export async function criarEquipamentoSeguranca(nome: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const nomeResult = validarNome(nome);
  if (!nomeResult.ok) return { ok: false, error: nomeResult.error };

  const { error } = await supabaseAdmin.from('equipamentos_seguranca').insert({ nome: nomeResult.nome });
  if (error) return { ok: false, error: erroDuplicado(error.code, 'um', 'equipamento de segurança') ?? error.message };
  return { ok: true };
}

export async function atualizarEquipamentoSeguranca(id: string, nome: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const nomeResult = validarNome(nome);
  if (!nomeResult.ok) return { ok: false, error: nomeResult.error };

  const { error } = await supabaseAdmin.from('equipamentos_seguranca').update({ nome: nomeResult.nome }).eq('id', id);
  if (error) return { ok: false, error: erroDuplicado(error.code, 'um', 'equipamento de segurança') ?? error.message };
  return { ok: true };
}

export async function excluirEquipamentoSeguranca(id: string, confirmado = false): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!confirmado) {
    const { count } = await supabaseAdmin
      .from('embarcacao_equipamentos_seguranca')
      .select('id', { count: 'exact', head: true })
      .eq('equipamento_seguranca_id', id);
    if ((count ?? 0) > 0) return { ok: false, error: 'EM_USO', vinculos: count ?? 0 };
  }

  const { error } = await supabaseAdmin.from('equipamentos_seguranca').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
