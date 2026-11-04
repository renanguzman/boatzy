'use server';

import { validarDocumentoEquipe } from '@/lib/equipe-documento';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { isValidCPF, onlyDigits } from '@/lib/validators';
import { ehUuid } from '@/lib/upload-imagem-server';
import { ensureGestorEquipeMembro } from '@/lib/equipe';
import { analisarCondutor, type AnaliseCondutor } from '@/lib/documentos/server';
import { apagarArquivoDocumento } from '@/lib/documentos/arquivo-server';
import {
  arquivoDoDocumento, cpfTitular, dadosLimpos, dataOuNull, inserirDocumento, texto, validarCamposDocumento,
} from '@/lib/documentos/registro';
import { TIPOS_DOCUMENTO, normalizarCategorias } from '@/lib/documentos/tipos';
import { nomeApresentavel } from '@/lib/documentos/nomes';
import type { CondutorPayload, DocumentoPayload } from '@/lib/documentos/rascunho';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos (os payloads ficam em `@/lib/documentos/rascunho` — arquivo 'use server' não reexporta)
// ─────────────────────────────────────────────────────────────────────────────

export type SalvarDocumentoResult =
  | { ok: true; documentoId: string; membroCriado: { id: string; nome: string } | null }
  | { ok: false; error: string };

type ActionResult = { ok: boolean; error?: string };

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

async function embarcacaoDoGestor(ownerId: string, id: string | null): Promise<boolean> {
  if (!id || !ehUuid(id)) return false;
  const { data } = await supabaseAdmin.from('embarcacao').select('id').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  return !!data;
}

/** Só as embarcações (sem repetir) que são do gestor. */
async function embarcacoesDoGestor(ownerId: string, ids: string[]): Promise<string[]> {
  const unicos = [...new Set(ids.filter(ehUuid))];
  if (unicos.length === 0) return [];
  const { data } = await supabaseAdmin.from('embarcacao').select('id').eq('owner_id', ownerId).in('id', unicos);
  return (data ?? []).map((e) => e.id);
}

/**
 * Garante o vínculo membro ↔ embarcações na equipe (idempotente). Só acrescenta:
 * as embarcações que a pessoa já atende continuam.
 */
async function vincularMembroEmbarcacoes(membroId: string, embarcacaoIds: string[]) {
  if (embarcacaoIds.length === 0) return;
  await supabaseAdmin
    .from('equipe_membro_embarcacao')
    .upsert(
      embarcacaoIds.map((embarcacao_id) => ({ equipe_membro_id: membroId, embarcacao_id })),
      { onConflict: 'equipe_membro_id,embarcacao_id', ignoreDuplicates: true },
    );
}

/**
 * Membro da equipe sem CPF recebe o da habilitação (completa o cadastro), se
 * ninguém mais da equipe tiver esse CPF. Nunca sobrescreve um CPF já informado.
 */
async function completarCpfMembro(ownerId: string, membroId: string, cpf: string | null) {
  if (!cpf) return;
  const { data: outro } = await supabaseAdmin
    .from('equipe_membro')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('cpf', cpf)
    .neq('id', membroId)
    .maybeSingle();
  if (outro) return;
  await supabaseAdmin.from('equipe_membro').update({ cpf }).eq('id', membroId).eq('owner_id', ownerId).is('cpf', null);
}

/**
 * Resolve o condutor: membro existente (do próprio gestor) ou cadastro novo
 * na equipe — sem telefone (pendente) e com o CPF lido do documento, se válido.
 */
async function resolverCondutor(
  ownerId: string,
  c: CondutorPayload | null,
  embarcacaoIds: string[],
  cpfDocumento: string | null,
): Promise<{ ok: true; membroId: string; criado: { id: string; nome: string } | null } | { ok: false; error: string }> {
  if (!c) return { ok: false, error: 'Indique quem é o condutor.' };

  if (c.modo === 'existente') {
    if (!ehUuid(c.membroId)) return { ok: false, error: 'Condutor inválido.' };
    const { data } = await supabaseAdmin
      .from('equipe_membro')
      .select('id, is_gestor')
      .eq('id', c.membroId)
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (!data) return { ok: false, error: 'Condutor não encontrado na sua equipe.' };
    if (!data.is_gestor) {
      await vincularMembroEmbarcacoes(data.id, embarcacaoIds);
      await completarCpfMembro(ownerId, data.id, cpfDocumento);
    }
    return { ok: true, membroId: data.id, criado: null };
  }

  const nome = nomeApresentavel(c.nome);
  if (nome.length < 3) return { ok: false, error: 'Informe o nome do condutor.' };
  if (!['marinheiro', 'capitao', 'auxiliar'].includes(c.funcao)) return { ok: false, error: 'Função inválida.' };

  // Estrangeiro sem CPF (SPEC §104): passaporte / registro de identificação no lugar do CPF.
  if (c.estrangeiro) {
    const v = validarDocumentoEquipe(c.estrangeiro);
    if (!v.ok) return { ok: false, error: v.erro };
    const { data: mesmo } = await supabaseAdmin
      .from('equipe_membro')
      .select('id, is_gestor')
      .eq('owner_id', ownerId)
      .eq('pais_documento', v.valor.pais)
      .eq('documento_estrangeiro', v.valor.documento)
      .maybeSingle();
    if (mesmo) {
      if (!mesmo.is_gestor) await vincularMembroEmbarcacoes(mesmo.id, embarcacaoIds);
      return { ok: true, membroId: mesmo.id, criado: null };
    }
    const { data: novoEstrangeiro, error: erroEstrangeiro } = await supabaseAdmin
      .from('equipe_membro')
      .insert({
        owner_id: ownerId, is_gestor: false, nome_completo: nome, cpf: null, telefone: null, funcao: c.funcao, ativo: true,
        tipo_documento_estrangeiro: v.valor.tipo, documento_estrangeiro: v.valor.documento, pais_documento: v.valor.pais,
      })
      .select('id')
      .single();
    if (erroEstrangeiro || !novoEstrangeiro) return { ok: false, error: erroEstrangeiro?.message ?? 'Não foi possível cadastrar o condutor na equipe.' };
    await vincularMembroEmbarcacoes(novoEstrangeiro.id, embarcacaoIds);
    return { ok: true, membroId: novoEstrangeiro.id, criado: { id: novoEstrangeiro.id, nome } };
  }

  const cpf = isValidCPF(c.cpf) ? onlyDigits(c.cpf) : cpfDocumento;

  // Mesmo CPF já na equipe: usa a pessoa existente em vez de duplicar.
  if (cpf) {
    const { data: mesmo } = await supabaseAdmin
      .from('equipe_membro')
      .select('id, is_gestor')
      .eq('owner_id', ownerId)
      .eq('cpf', cpf)
      .maybeSingle();
    if (mesmo) {
      if (!mesmo.is_gestor) await vincularMembroEmbarcacoes(mesmo.id, embarcacaoIds);
      return { ok: true, membroId: mesmo.id, criado: null };
    }
  }

  const { data: novo, error } = await supabaseAdmin
    .from('equipe_membro')
    .insert({ owner_id: ownerId, is_gestor: false, nome_completo: nome, cpf, telefone: null, funcao: c.funcao, ativo: true })
    .select('id')
    .single();
  if (error || !novo) return { ok: false, error: error?.message ?? 'Não foi possível cadastrar o condutor na equipe.' };

  await vincularMembroEmbarcacoes(novo.id, embarcacaoIds);
  return { ok: true, membroId: novo.id, criado: { id: novo.id, nome } };
}

function revalidar() {
  revalidatePath('/painel/documentos');
  revalidatePath('/painel', 'layout');
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Quem da equipe é o condutor lido na habilitação (passo de conferência). */
export async function analisarCondutorDocumento(nome: string, cpf: string): Promise<AnaliseCondutor> {
  const { user } = await authGestor();
  if (!user) return { resultado: 'novo' };
  await ensureGestorEquipeMembro(user.id);
  return analisarCondutor(user.id, nome, isValidCPF(cpf) ? onlyDigits(cpf) : null);
}

/**
 * Cria um documento. Do mesmo tipo e para a mesma embarcação/condutor, o
 * documento ativo anterior vai para o histórico (renovação).
 */
export async function criarDocumento(p: DocumentoPayload): Promise<SalvarDocumentoResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };
  if (!ehUuid(p.id)) return { ok: false, error: 'Envio inválido. Recarregue a página e tente de novo.' };

  const erroCampos = validarCamposDocumento(p);
  if (erroCampos) return { ok: false, error: erroCampos };

  if (!p.arquivo) return { ok: false, error: 'Envie a foto ou o PDF do documento.' };
  if (!arquivoDoDocumento(p.arquivo, user.id, p.id)) return { ok: false, error: 'Arquivo inválido. Envie o documento novamente.' };

  let embarcacaoId: string | null = null;
  let membroId: string | null = null;
  let membroCriado: { id: string; nome: string } | null = null;

  if (p.escopo === 'embarcacao') {
    if (!(await embarcacaoDoGestor(user.id, p.embarcacaoId))) return { ok: false, error: 'Escolha uma das suas embarcações.' };
    embarcacaoId = p.embarcacaoId;
  } else {
    const barcosCondutor = await embarcacoesDoGestor(user.id, p.embarcacoesDoCondutorIds ?? []);
    const r = await resolverCondutor(user.id, p.condutor, barcosCondutor, cpfTitular(p));
    if (!r.ok) return { ok: false, error: r.error };
    membroId = r.membroId;
    membroCriado = r.criado;
  }

  const r = await inserirDocumento(user.id, { ...p, arquivo: p.arquivo }, embarcacaoId ? { embarcacaoId } : { membroId: membroId! });
  if (!r.ok) return r;

  revalidar();
  if (membroCriado) revalidatePath('/painel/equipe');
  return { ok: true, documentoId: p.id, membroCriado };
}

/** Edita os dados (e opcionalmente troca o arquivo) de um documento. Tipo e alvo não mudam. */
export async function atualizarDocumento(p: DocumentoPayload): Promise<SalvarDocumentoResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };
  if (!ehUuid(p.id)) return { ok: false, error: 'Documento inválido.' };

  const { data: atual } = await supabaseAdmin
    .from('documento')
    .select('id, tipo, escopo, arquivo_key')
    .eq('id', p.id)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!atual) return { ok: false, error: 'Documento não encontrado.' };

  const payload = { ...p, tipo: atual.tipo, escopo: atual.escopo };
  const erroCampos = validarCamposDocumento(payload);
  if (erroCampos) return { ok: false, error: erroCampos };

  if (p.arquivo && !arquivoDoDocumento(p.arquivo, user.id, p.id)) {
    return { ok: false, error: 'Arquivo inválido. Envie o documento novamente.' };
  }

  const info = TIPOS_DOCUMENTO[atual.tipo];
  const { error: updErr } = await supabaseAdmin
    .from('documento')
    .update({
      titulo: info.temTitulo ? texto(p.titulo, 80) : null,
      numero: texto(p.numero, 40),
      titular: texto(p.titular),
      titular_cpf: cpfTitular(payload),
      embarcacao_nome: atual.escopo === 'embarcacao' ? texto(p.embarcacaoNome, 80) : null,
      categoria: info.temCategoria ? normalizarCategorias(p.categoria) : null,
      data_emissao: dataOuNull(p.dataEmissao),
      data_validade: dataOuNull(p.dataValidade),
      dados: dadosLimpos(p.dados, atual.escopo),
      ...(p.arquivo
        ? {
            arquivo_key: p.arquivo.key,
            arquivo_nome: p.arquivo.nome.slice(-120),
            arquivo_tipo: p.arquivo.tipo,
            arquivo_tamanho: p.arquivo.tamanho,
            origem: p.origem,
          }
        : {}),
    })
    .eq('id', p.id);
  if (updErr) return { ok: false, error: updErr.message };

  if (p.arquivo && atual.arquivo_key && atual.arquivo_key !== p.arquivo.key) {
    await apagarArquivoDocumento(atual.arquivo_key);
  }

  revalidar();
  return { ok: true, documentoId: p.id, membroCriado: null };
}

/** Exclui o documento e o arquivo. Excluir o ativo não reativa o histórico. */
export async function excluirDocumento(id: string): Promise<ActionResult> {
  const { user, error } = await authGestor();
  if (!user) return { ok: false, error: error! };
  if (!ehUuid(id)) return { ok: false, error: 'Documento inválido.' };

  const { data: doc } = await supabaseAdmin
    .from('documento')
    .select('id, arquivo_key')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!doc) return { ok: false, error: 'Documento não encontrado.' };

  const { error: delErr } = await supabaseAdmin.from('documento').delete().eq('id', id);
  if (delErr) return { ok: false, error: delErr.message };
  await apagarArquivoDocumento(doc.arquivo_key);

  revalidar();
  return { ok: true };
}
