'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRolesFromDb } from '@/lib/roles';
import { isValidCpfOuCnpj, onlyDigits } from '@/lib/validators';
import { ensureGestorEquipeMembro } from '@/lib/equipe';
import { habilitacaoDoGestor } from '@/lib/documentos/server';
import { arquivoDoDocumento, inserirDocumento, validarCamposDocumento } from '@/lib/documentos/registro';
import { ehUuid } from '@/lib/upload-imagem-server';
import type { DocumentoPayload } from '@/lib/documentos/rascunho';
import { notificarAdminsNovaSolicitacao } from '@/lib/emails/solicitacao-gestor';

/** Quem conduz a embarcação nos passeios: o próprio gestor (envia a habilitação) ou a equipe dele. */
export type ConducaoSolicitacao = 'proprio' | 'equipe';

export type SolicitarAcessoGestorInput = {
  nome: string;
  telefone: string; // E.164
  documento: string; // CPF ou CNPJ, com ou sem máscara
  estadoId: number;
  municipioId: number;
  qtdEmbarcacoes: number;
  mensagem: string;
  conducao: ConducaoSolicitacao;
  /**
   * Habilitação do próprio gestor (CHA/CIR), com o arquivo já no bucket privado. Obrigatória
   * quando ele conduz — salvo se já tiver uma ativa (pedido recusado e refeito).
   */
  habilitacao: DocumentoPayload | null;
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

  // Condução (SPEC §95.10): quem conduz envia a própria habilitação junto com o pedido.
  if (input.conducao !== 'proprio' && input.conducao !== 'equipe') {
    return { ok: false, error: 'Conte quem vai conduzir a embarcação nos passeios.' };
  }
  const habilitacao = input.conducao === 'proprio' ? input.habilitacao : null;
  if (habilitacao) {
    if (!ehUuid(habilitacao.id) || habilitacao.escopo !== 'condutor' || !['cha', 'cir'].includes(habilitacao.tipo)) {
      return { ok: false, error: 'Habilitação inválida. Envie a CHA ou a CIR.' };
    }
    const erroHabilitacao = validarCamposDocumento(habilitacao);
    if (erroHabilitacao) return { ok: false, error: erroHabilitacao };
    if (!arquivoDoDocumento(habilitacao.arquivo, user.id, habilitacao.id)) {
      return { ok: false, error: 'Envie a foto ou o PDF da sua habilitação novamente.' };
    }
  } else if (input.conducao === 'proprio' && !(await habilitacaoDoGestor(user.id)).documento) {
    return { ok: false, error: 'Envie a foto ou o PDF da sua habilitação náutica.' };
  }

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

  // Habilitação do gestor: vai para a ficha "Você (gestor)" da equipe — criada só agora,
  // depois do celular/CPF no perfil, porque ela os herda (o cliente vê o celular de quem atende).
  if (habilitacao?.arquivo) {
    const membroId = await ensureGestorEquipeMembro(user.id);
    if (membroId) {
      await supabaseAdmin.from('equipe_membro').update({ telefone }).eq('id', membroId).is('telefone', null);
      const r = await inserirDocumento(user.id, { ...habilitacao, arquivo: habilitacao.arquivo }, { membroId });
      if (!r.ok) console.error('[solicitacao-gestor] habilitação não salva:', r.error);
    } else {
      console.error('[solicitacao-gestor] sem ficha do gestor para a habilitação:', user.id);
    }
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
      conducao: input.conducao,
    }),
  );

  revalidatePath('/painel', 'layout');
  return { ok: true };
}
