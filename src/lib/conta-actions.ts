'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidCPF, isValidBirthday, onlyDigits } from '@/lib/validators';

export type AtualizarPerfilInput = {
  name: string;
  cpf: string; // com ou sem máscara
  phone: string; // E.164 (ex.: +5511912345678) ou vazio
  birthday: string; // 'yyyy-mm-dd' ou vazio — opcional
};

export type AtualizarPerfilResult =
  | { ok: true }
  | {
      ok: false;
      error: 'nao_autenticado' | 'nome_invalido' | 'cpf_invalido' | 'nascimento_invalido' | 'erro';
    };

/**
 * Atualiza os dados do perfil do cliente logado (nome, CPF, celular e data
 * de nascimento) em public.users. O e-mail não é editável aqui (troca de
 * e-mail exige reconfirmação no Supabase Auth — fora do escopo desta tela).
 */
export async function atualizarPerfil(
  input: AtualizarPerfilInput,
): Promise<AtualizarPerfilResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'nao_autenticado' };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'nome_invalido' };

  // CPF é opcional (contas SSO podem não ter), mas se informado precisa ser válido.
  const cpfDigits = onlyDigits(input.cpf);
  if (cpfDigits && !isValidCPF(cpfDigits)) return { ok: false, error: 'cpf_invalido' };

  const phone = input.phone.trim() || null;

  // Data de nascimento é opcional, mas se informada precisa ser uma data real e não futura.
  const birthday = input.birthday.trim() || null;
  if (birthday && !isValidBirthday(birthday)) return { ok: false, error: 'nascimento_invalido' };

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      name,
      cpf_cnpj: cpfDigits || null,
      phone,
      birthday,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'erro' };

  revalidatePath('/minha-conta');
  return { ok: true };
}

// ─── Notificações ───────────────────────────────────────────────────────────

export type AtualizarNotificacoesResult =
  | { ok: true }
  | { ok: false; error: 'nao_autenticado' | 'erro' };

/** Habilita/desabilita o e-mail de notificação de novas conversas. */
export async function atualizarNotifEmailConversas(
  ativo: boolean,
): Promise<AtualizarNotificacoesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'nao_autenticado' };

  const { error } = await supabaseAdmin
    .from('users')
    .update({ notif_email_conversas: ativo, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'erro' };

  revalidatePath('/minha-conta');
  return { ok: true };
}

// ─── Endereço (opcional) ────────────────────────────────────────────────────

/** Municípios de um estado (mesma fonte do cadastro de roteiro). */
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

export type AtualizarEnderecoInput = {
  cep: string;
  estado_id: string; // string vinda do <select>; '' quando vazio
  municipio_id: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
};

export type AtualizarEnderecoResult =
  | { ok: true }
  | { ok: false; error: 'nao_autenticado' | 'erro' };

/**
 * Atualiza o endereço (opcional) do cliente logado. Todos os campos podem
 * ficar vazios — nesse caso o endereço é limpo (NULL).
 */
export async function atualizarEndereco(
  input: AtualizarEnderecoInput,
): Promise<AtualizarEnderecoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'nao_autenticado' };

  const cep = onlyDigits(input.cep);
  const estadoId = input.estado_id ? parseInt(input.estado_id, 10) : null;
  const municipioId = input.municipio_id ? parseInt(input.municipio_id, 10) : null;
  const trim = (v: string) => v.trim() || null;

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      endereco_cep: cep || null,
      endereco_estado_id: Number.isNaN(estadoId as number) ? null : estadoId,
      endereco_municipio_id: Number.isNaN(municipioId as number) ? null : municipioId,
      endereco_bairro: trim(input.bairro),
      endereco_logradouro: trim(input.logradouro),
      endereco_numero: trim(input.numero),
      endereco_complemento: trim(input.complemento),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'erro' };

  revalidatePath('/minha-conta');
  return { ok: true };
}
