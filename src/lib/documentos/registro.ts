import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { isValidCPF, onlyDigits } from '@/lib/validators';
import type { DocumentoEscopo, Json } from '@/types/supabase';
import { pastaDocumento } from './arquivo-server';
import type { ArquivoEnviado } from './envio';
import type { DocumentoPayload } from './rascunho';
import { CATEGORIAS_CHA, TIPOS_DOCUMENTO, TIPOS_POR_ESCOPO, normalizarCategorias, type DadosDocumento } from './tipos';

/**
 * Validação e gravação de documentos no servidor (SPEC §95.6 e §95.10) — usadas pelas
 * actions do painel (`documentos/actions.ts`) e pelo pedido de acesso do gestor, que
 * envia a própria habilitação antes de ter o papel de gestor.
 */

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function dataOuNull(v: string): string | null {
  const s = v.trim();
  return RE_DATA.test(s) ? s : null;
}

export const texto = (v: string, max = 160) => v.trim().replace(/\s+/g, ' ').slice(0, max) || null;

export function validarCamposDocumento(p: DocumentoPayload): string | null {
  const info = TIPOS_DOCUMENTO[p.tipo];
  if (!info || !TIPOS_POR_ESCOPO[p.escopo]?.includes(p.tipo)) return 'Tipo de documento inválido.';
  if (info.temTitulo && !p.titulo.trim()) return 'Informe o nome do documento.';
  if (p.dataEmissao.trim() && !dataOuNull(p.dataEmissao)) return 'Data de emissão inválida.';
  if (p.dataValidade.trim() && !dataOuNull(p.dataValidade)) return 'Data de validade inválida.';
  if (info.validadeAnos != null && !dataOuNull(p.dataValidade)) {
    return `Informe a validade do ${info.sigla} — é ela que gera os avisos de vencimento.`;
  }
  const emissao = dataOuNull(p.dataEmissao);
  const validade = dataOuNull(p.dataValidade);
  if (emissao && validade && validade < emissao) return 'A validade não pode ser anterior à emissão.';
  const cats = p.categoria.split(',').map((c) => c.trim()).filter(Boolean);
  if (cats.some((c) => !CATEGORIAS_CHA.some((x) => x.valor === c))) return 'Categoria inválida.';
  if (p.escopo === 'condutor' && onlyDigits(p.cpf ?? '') && !isValidCPF(p.cpf)) return 'CPF do condutor inválido — confira os números.';
  return null;
}

/** CPF do titular, só na habilitação e só se válido. */
export function cpfTitular(p: Pick<DocumentoPayload, 'escopo' | 'cpf'>): string | null {
  return p.escopo === 'condutor' && isValidCPF(p.cpf ?? '') ? onlyDigits(p.cpf) : null;
}

/** Extras aceitos por escopo e o tamanho máximo de cada texto. */
const EXTRAS_TEXTO: Record<DocumentoEscopo, [keyof DadosDocumento, number][]> = {
  embarcacao: [['tipo_embarcacao', 60], ['area_navegacao', 60], ['atividade', 60]],
  condutor: [['limites_navegacao', 120], ['orgao_emissor', 80]],
};

export function dadosLimpos(d: DadosDocumento, escopo: DocumentoEscopo): Json {
  const out: Record<string, string | number> = {};
  for (const [chave, max] of EXTRAS_TEXTO[escopo]) {
    const v = d[chave];
    if (typeof v === 'string' && v.trim()) out[chave] = v.trim().replace(/\s+/g, ' ').slice(0, max);
  }
  if (escopo === 'embarcacao') {
    for (const chave of ['qtd_passageiros', 'qtd_tripulantes'] as const) {
      const v = d[chave];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10000) out[chave] = v;
    }
  }
  return out;
}

/** O arquivo enviado está na pasta deste documento, do próprio usuário. */
export function arquivoDoDocumento(arquivo: ArquivoEnviado | null, ownerId: string, documentoId: string): boolean {
  return !!arquivo && arquivo.key.startsWith(pastaDocumento(ownerId, documentoId)) && !arquivo.key.includes('..');
}

/**
 * Grava o documento (já validado) para a embarcação ou o membro da equipe. Do mesmo
 * tipo e alvo, o ativo anterior vai para o histórico (renovação) — e volta se a
 * gravação falhar, para o alvo não ficar sem documento ativo.
 */
export async function inserirDocumento(
  ownerId: string,
  p: DocumentoPayload & { arquivo: ArquivoEnviado },
  alvo: { embarcacaoId: string } | { membroId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const embarcacaoId = 'embarcacaoId' in alvo ? alvo.embarcacaoId : null;
  const membroId = 'membroId' in alvo ? alvo.membroId : null;

  // Renovação: arquiva o ativo do mesmo tipo e alvo ('outro' pode ter vários).
  let arquivados: string[] = [];
  if (p.tipo !== 'outro') {
    const filtro = supabaseAdmin
      .from('documento')
      .update({ arquivado_em: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('tipo', p.tipo)
      .is('arquivado_em', null);
    const { data } = await (embarcacaoId ? filtro.eq('embarcacao_id', embarcacaoId) : filtro.eq('equipe_membro_id', membroId!)).select('id');
    arquivados = (data ?? []).map((d) => d.id);
  }

  const info = TIPOS_DOCUMENTO[p.tipo];
  const { error } = await supabaseAdmin.from('documento').insert({
    id: p.id,
    owner_id: ownerId,
    escopo: p.escopo,
    tipo: p.tipo,
    embarcacao_id: embarcacaoId,
    equipe_membro_id: membroId,
    titulo: info.temTitulo ? texto(p.titulo, 80) : null,
    numero: texto(p.numero, 40),
    titular: texto(p.titular),
    titular_cpf: cpfTitular(p),
    embarcacao_nome: p.escopo === 'embarcacao' ? texto(p.embarcacaoNome, 80) : null,
    categoria: info.temCategoria ? normalizarCategorias(p.categoria) : null,
    data_emissao: dataOuNull(p.dataEmissao),
    data_validade: dataOuNull(p.dataValidade),
    dados: dadosLimpos(p.dados, p.escopo),
    arquivo_key: p.arquivo.key,
    arquivo_nome: p.arquivo.nome.slice(-120),
    arquivo_tipo: p.arquivo.tipo,
    arquivo_tamanho: p.arquivo.tamanho,
    origem: p.origem,
  });

  if (error) {
    if (arquivados.length > 0) {
      await supabaseAdmin.from('documento').update({ arquivado_em: null }).in('id', arquivados);
    }
    if (error.code === '23505') return { ok: false, error: 'Este documento já foi salvo. Atualize a página.' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
