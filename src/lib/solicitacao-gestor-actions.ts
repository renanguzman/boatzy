'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRolesFromDb } from '@/lib/roles';
import { isValidCpfOuCnpj, onlyDigits } from '@/lib/validators';
import { notificarAdminsNovaSolicitacao } from '@/lib/emails/solicitacao-gestor';

export type SolicitarAcessoGestorInput = {
  nome: string;
  telefone: string; // E.164
  documento: string; // CPF ou CNPJ, com ou sem máscara
  estadoId: number;
  municipioId: number;
  qtdEmbarcacoes: number;
  mensagem: string;
};

export type SolicitarAcessoGestorResult = { ok: true } | { ok: false; error: string };

/**
 * Registra o pedido de acesso de gestor do usuário logado. Não concede o
 * papel: ele só vem quando o admin aprova (SPEC §62). Avisa os admins por e-mail.
 */
export async function solicitarAcessoGestor(
  input: SolicitarAcessoGestorInput,
): Promise<SolicitarAcessoGestorResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre novamente.' };

  const roles = await getRolesFromDb(user.id);
  if (roles.includes('gestor') || roles.includes('admin')) {
    return { ok: false, error: 'Sua conta já tem acesso ao painel.' };
  }

  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 200) return { ok: false, error: 'Informe seu nome completo.' };

  const telefone = input.telefone.trim();
  if (!/^\+[0-9]{8,15}$/.test(telefone)) return { ok: false, error: 'Informe um celular válido.' };

  const documento = onlyDigits(input.documento);
  if (!isValidCpfOuCnpj(documento)) return { ok: false, error: 'Informe um CPF ou CNPJ válido.' };

  const qtd = Math.trunc(input.qtdEmbarcacoes);
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 999) {
    return { ok: false, error: 'Informe quantas embarcações você tem (de 1 a 999).' };
  }

  const mensagem = input.mensagem.trim();
  if (mensagem.length > 1000) return { ok: false, error: 'A mensagem pode ter no máximo 1000 caracteres.' };

  // O município precisa pertencer ao estado escolhido.
  const { data: municipio } = await supabaseAdmin
    .from('municipios')
    .select('nome, estado_id, estados ( uf )')
    .eq('id', input.municipioId)
    .maybeSingle();
  if (!municipio || municipio.estado_id !== input.estadoId) {
    return { ok: false, error: 'Escolha a cidade onde fica a embarcação.' };
  }

  const { data: criada, error } = await supabaseAdmin
    .from('solicitacao_gestor')
    .insert({
      user_id: user.id,
      nome,
      telefone,
      documento,
      estado_id: input.estadoId,
      municipio_id: input.municipioId,
      qtd_embarcacoes: qtd,
      mensagem: mensagem || null,
    })
    .select('id, created_at')
    .single();

  if (error || !criada) {
    // 23505 = já existe um pedido pendente deste usuário (índice único parcial).
    if (error?.code === '23505') return { ok: false, error: 'Você já tem um pedido em análise.' };
    return { ok: false, error: 'Não foi possível enviar o pedido. Tente novamente.' };
  }

  // Completa o cadastro com o que ainda faltava (nunca sobrescreve o que o usuário já informou).
  const { data: perfil } = await supabaseAdmin
    .from('users')
    .select('phone, cpf_cnpj, email')
    .eq('id', user.id)
    .maybeSingle();
  if (perfil && (!perfil.phone || !perfil.cpf_cnpj)) {
    await supabaseAdmin
      .from('users')
      .update({
        ...(perfil.phone ? {} : { phone: telefone }),
        ...(perfil.cpf_cnpj ? {} : { cpf_cnpj: documento }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
  }

  const uf = (municipio.estados as unknown as { uf: string } | null)?.uf ?? '';
  after(() =>
    notificarAdminsNovaSolicitacao({
      id: criada.id,
      nome,
      email: perfil?.email ?? user.email ?? '',
      municipio: uf ? `${municipio.nome}/${uf}` : municipio.nome,
      qtdEmbarcacoes: qtd,
      criadoEm: criada.created_at,
    }),
  );

  revalidatePath('/painel', 'layout');
  return { ok: true };
}
