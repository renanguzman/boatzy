'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { onlyDigits, isValidCPF } from '@/lib/validators';
import { deleteFromR2, buildKeyFromUrl } from '@/lib/r2';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type MembroFormPayload = {
  nome_completo: string;
  cpf: string;
  email: string;
  telefone: string;
  /** Embarcações em que o membro é indicado como atendente. */
  embarcacaoIds: string[];
  /** Conta da plataforma a vincular (opcional). */
  vincularUserId?: string | null;
};

export type CriarMembroResult =
  | { ok: true; membroId: string }
  | { ok: false; error: string };

type ActionResult = { ok: boolean; error?: string };

export type UsuarioVinculavel = {
  id: string;
  name: string;
  email: string;
  cpf_cnpj: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function authGestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: 'Não autenticado.' };
  const ok = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!ok) return { user: null, error: 'Acesso não autorizado.' };
  return { user, error: null };
}

function validarCampos(p: MembroFormPayload): string | null {
  if (!p.nome_completo.trim()) return 'O nome completo é obrigatório.';
  if (!isValidCPF(p.cpf)) return 'CPF inválido.';
  const tel = onlyDigits(p.telefone);
  if (tel.length < 10 || tel.length > 11) return 'Telefone inválido — informe DDD + número.';
  const email = p.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.';
  if (!p.embarcacaoIds || p.embarcacaoIds.length === 0) {
    return 'Vincule o membro a pelo menos uma embarcação.';
  }
  return null;
}

async function embarcacoesDoGestor(ownerId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const unicos = [...new Set(ids)];
  const { data } = await supabaseAdmin
    .from('embarcacao')
    .select('id')
    .eq('owner_id', ownerId)
    .in('id', unicos);
  return (data?.length ?? 0) === unicos.length;
}

async function membroDoGestor(ownerId: string, membroId: string) {
  const { data } = await supabaseAdmin
    .from('equipe_membro')
    .select('id, owner_id, is_gestor, foto_url')
    .eq('id', membroId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  return data;
}

async function resolverUserVinculo(vincularUserId: string | null | undefined): Promise<string | null> {
  if (!vincularUserId) return null;
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', vincularUserId)
    .maybeSingle();
  return data?.id ?? null;
}

async function sincronizarEmbarcacoes(membroId: string, ids: string[]): Promise<void> {
  const unicos = [...new Set(ids)];

  const { data: atuais } = await supabaseAdmin
    .from('equipe_membro_embarcacao')
    .select('embarcacao_id')
    .eq('equipe_membro_id', membroId);

  const setAtual = new Set((atuais ?? []).map((r) => r.embarcacao_id));
  const setNovo = new Set(unicos);

  const remover = [...setAtual].filter((id) => !setNovo.has(id));
  const inserir = unicos.filter((id) => !setAtual.has(id));

  if (remover.length > 0) {
    await supabaseAdmin
      .from('equipe_membro_embarcacao')
      .delete()
      .eq('equipe_membro_id', membroId)
      .in('embarcacao_id', remover);
  }
  if (inserir.length > 0) {
    await supabaseAdmin
      .from('equipe_membro_embarcacao')
      .insert(inserir.map((embarcacao_id) => ({ equipe_membro_id: membroId, embarcacao_id })));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions — CRUD de membro
// ─────────────────────────────────────────────────────────────────────────────

export async function criarMembro(payload: MembroFormPayload): Promise<CriarMembroResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };

  const erroCampos = validarCampos(payload);
  if (erroCampos) return { ok: false, error: erroCampos };

  if (!(await embarcacoesDoGestor(user.id, payload.embarcacaoIds))) {
    return { ok: false, error: 'Uma das embarcações selecionadas não é sua.' };
  }

  const userVinculo = await resolverUserVinculo(payload.vincularUserId);

  const { data, error: insErr } = await supabaseAdmin
    .from('equipe_membro')
    .insert({
      owner_id: user.id,
      user_id: userVinculo,
      is_gestor: false,
      nome_completo: payload.nome_completo.trim(),
      cpf: onlyDigits(payload.cpf),
      email: payload.email.trim() || null,
      telefone: onlyDigits(payload.telefone),
      ativo: true,
    })
    .select('id')
    .single();

  if (insErr || !data) {
    if (insErr?.code === '23505') {
      return { ok: false, error: 'Você já cadastrou um membro com este CPF.' };
    }
    return { ok: false, error: insErr?.message ?? 'Erro ao salvar o membro.' };
  }

  await sincronizarEmbarcacoes(data.id, payload.embarcacaoIds);

  revalidatePath('/painel/equipe');
  return { ok: true, membroId: data.id };
}

export async function atualizarMembro(
  membroId: string,
  payload: MembroFormPayload,
): Promise<ActionResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };

  const membro = await membroDoGestor(user.id, membroId);
  if (!membro) return { ok: false, error: 'Membro não encontrado ou sem permissão.' };
  if (membro.is_gestor) return { ok: false, error: 'A ficha do gestor não é editável por aqui.' };

  const erroCampos = validarCampos(payload);
  if (erroCampos) return { ok: false, error: erroCampos };

  if (!(await embarcacoesDoGestor(user.id, payload.embarcacaoIds))) {
    return { ok: false, error: 'Uma das embarcações selecionadas não é sua.' };
  }

  const userVinculo = await resolverUserVinculo(payload.vincularUserId);

  const { error: updErr } = await supabaseAdmin
    .from('equipe_membro')
    .update({
      user_id: userVinculo,
      nome_completo: payload.nome_completo.trim(),
      cpf: onlyDigits(payload.cpf),
      email: payload.email.trim() || null,
      telefone: onlyDigits(payload.telefone),
    })
    .eq('id', membroId);

  if (updErr) {
    if (updErr.code === '23505') {
      return { ok: false, error: 'Você já cadastrou um membro com este CPF.' };
    }
    return { ok: false, error: updErr.message };
  }

  await sincronizarEmbarcacoes(membroId, payload.embarcacaoIds);

  revalidatePath('/painel/equipe');
  revalidatePath(`/painel/equipe/${membroId}/editar`);
  return { ok: true };
}

export async function salvarFotoMembro(membroId: string, urlImagem: string): Promise<ActionResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };

  const membro = await membroDoGestor(user.id, membroId);
  if (!membro) return { ok: false, error: 'Membro não encontrado ou sem permissão.' };

  // Remove a foto anterior do R2 (se houver e for diferente).
  if (membro.foto_url && membro.foto_url !== urlImagem) {
    await deleteFromR2(buildKeyFromUrl(membro.foto_url)).catch(() => null);
  }

  const { error: updErr } = await supabaseAdmin
    .from('equipe_membro')
    .update({ foto_url: urlImagem })
    .eq('id', membroId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/painel/equipe');
  revalidatePath(`/painel/equipe/${membroId}/editar`);
  return { ok: true };
}

export async function removerFotoMembro(membroId: string): Promise<ActionResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };

  const membro = await membroDoGestor(user.id, membroId);
  if (!membro) return { ok: false, error: 'Membro não encontrado ou sem permissão.' };

  if (membro.foto_url) {
    await deleteFromR2(buildKeyFromUrl(membro.foto_url)).catch(() => null);
  }

  const { error: updErr } = await supabaseAdmin
    .from('equipe_membro')
    .update({ foto_url: null })
    .eq('id', membroId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/painel/equipe');
  revalidatePath(`/painel/equipe/${membroId}/editar`);
  return { ok: true };
}

export async function alternarAtivoMembro(membroId: string, ativo: boolean): Promise<ActionResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };

  const membro = await membroDoGestor(user.id, membroId);
  if (!membro) return { ok: false, error: 'Membro não encontrado ou sem permissão.' };
  if (membro.is_gestor) return { ok: false, error: 'A ficha do gestor está sempre ativa.' };

  const { error: updErr } = await supabaseAdmin
    .from('equipe_membro')
    .update({ ativo })
    .eq('id', membroId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/painel/equipe');
  return { ok: true };
}

export async function excluirMembro(membroId: string): Promise<ActionResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };

  const membro = await membroDoGestor(user.id, membroId);
  if (!membro) return { ok: false, error: 'Membro não encontrado ou sem permissão.' };
  if (membro.is_gestor) return { ok: false, error: 'A ficha do gestor não pode ser excluída.' };

  // Histórico: se já atendeu reservas, não exclui — apenas desativa.
  const { count } = await supabaseAdmin
    .from('reserva_atendente')
    .select('id', { count: 'exact', head: true })
    .eq('equipe_membro_id', membroId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'Este membro já atendeu reservas. Desative-o em vez de excluir para preservar o histórico.',
    };
  }

  if (membro.foto_url) {
    await deleteFromR2(buildKeyFromUrl(membro.foto_url)).catch(() => null);
  }

  const { error: delErr } = await supabaseAdmin
    .from('equipe_membro')
    .delete()
    .eq('id', membroId);

  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath('/painel/equipe');
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions — vínculo com conta da plataforma
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarUsuarioParaVincular(termo: string): Promise<UsuarioVinculavel[]> {
  const { user } = await authGestor();
  if (!user) return [];

  const q = termo.trim();
  if (q.length < 3) return [];

  const digits = onlyDigits(q);
  const filtros = [`email.ilike.%${q}%`, `name.ilike.%${q}%`];
  if (digits.length >= 3) filtros.push(`cpf_cnpj.ilike.%${digits}%`);

  const { data } = await supabaseAdmin
    .from('users')
    .select('id, name, email, cpf_cnpj')
    .or(filtros.join(','))
    .limit(8);

  return (data ?? []) as UsuarioVinculavel[];
}
