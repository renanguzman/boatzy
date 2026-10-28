import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { hojeISO } from '@/lib/datas';
import type { DocumentoEscopo, DocumentoOrigem, DocumentoTipo, EquipeFuncao } from '@/types/supabase';
import { TIPOS_INSCRICAO, type DadosDocumento } from './tipos';
import { DIAS_FAIXA_TOPO, diasParaVencer, situacaoValidade, type ResumoValidade } from './validade';
import { SIMILARIDADE_EXATA, SIMILARIDADE_SUGESTAO, similaridadeNomes } from './nomes';

/** Consultas da área de Documentos (SPEC §95). */

export type DocumentoItem = {
  id: string;
  escopo: DocumentoEscopo;
  tipo: DocumentoTipo;
  embarcacao_id: string | null;
  equipe_membro_id: string | null;
  titulo: string | null;
  numero: string | null;
  titular: string | null;
  embarcacao_nome: string | null;
  categoria: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  dados: DadosDocumento;
  tem_arquivo: boolean;
  arquivo_tipo: string | null;
  origem: DocumentoOrigem;
  arquivado_em: string | null;
  created_at: string;
};

export type MembroCondutor = {
  id: string;
  nome_completo: string;
  is_gestor: boolean;
  funcao: EquipeFuncao | null;
  ativo: boolean;
  /** Falta CPF ou telefone (ex.: cadastrado automaticamente pela habilitação). */
  incompleto: boolean;
};

const COLUNAS_DOCUMENTO =
  'id, escopo, tipo, embarcacao_id, equipe_membro_id, titulo, numero, titular, embarcacao_nome, categoria, data_emissao, data_validade, dados, arquivo_key, arquivo_tipo, origem, arquivado_em, created_at';

type LinhaDocumento = Omit<DocumentoItem, 'tem_arquivo' | 'dados'> & { arquivo_key: string | null; dados: unknown };

function paraItem(r: LinhaDocumento): DocumentoItem {
  const { arquivo_key, dados, ...resto } = r;
  return { ...resto, dados: (dados ?? {}) as DadosDocumento, tem_arquivo: !!arquivo_key };
}

/** Todos os documentos do gestor (ativos e histórico). */
export async function listarDocumentos(ownerId: string): Promise<DocumentoItem[]> {
  const { data } = await supabaseAdmin
    .from('documento')
    .select(COLUNAS_DOCUMENTO)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as unknown as LinhaDocumento[]).map(paraItem);
}

export async function obterDocumento(ownerId: string, id: string): Promise<DocumentoItem | null> {
  const { data } = await supabaseAdmin
    .from('documento')
    .select(COLUNAS_DOCUMENTO)
    .eq('owner_id', ownerId)
    .eq('id', id)
    .maybeSingle();
  return data ? paraItem(data as unknown as LinhaDocumento) : null;
}

export async function listarEmbarcacoesDoGestor(ownerId: string): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabaseAdmin
    .from('embarcacao')
    .select('id, nome')
    .eq('owner_id', ownerId)
    .order('nome', { ascending: true });
  return data ?? [];
}

/** Equipe do gestor como condutores possíveis (o próprio gestor primeiro). */
export async function listarCondutores(ownerId: string): Promise<MembroCondutor[]> {
  const { data } = await supabaseAdmin
    .from('equipe_membro')
    .select('id, nome_completo, is_gestor, funcao, ativo, cpf, telefone')
    .eq('owner_id', ownerId)
    .order('is_gestor', { ascending: false })
    .order('nome_completo', { ascending: true });
  return (data ?? []).map((m) => ({
    id: m.id,
    nome_completo: m.nome_completo,
    is_gestor: m.is_gestor,
    funcao: m.funcao,
    ativo: m.ativo,
    incompleto: !m.is_gestor && (!m.cpf || !m.telefone),
  }));
}

/**
 * Contadores do painel de validade (dashboard, menu e faixa do topo).
 * `pendentes` = embarcações sem nenhum documento de inscrição ativo (TIE, TIEM ou PRPM).
 */
export async function getResumoDocumentos(ownerId: string): Promise<ResumoValidade> {
  const [{ data: docs }, { data: barcos }] = await Promise.all([
    supabaseAdmin
      .from('documento')
      .select('tipo, embarcacao_id, data_validade')
      .eq('owner_id', ownerId)
      .is('arquivado_em', null),
    supabaseAdmin.from('embarcacao').select('id').eq('owner_id', ownerId),
  ]);

  const hoje = hojeISO();
  const resumo: ResumoValidade = { vencidos: 0, venceEmBreve: 0, emDia: 0, pendentes: 0, urgentes: 0, total: 0 };
  const comInscricao = new Set<string>();
  for (const d of docs ?? []) {
    resumo.total++;
    if (d.embarcacao_id && TIPOS_INSCRICAO.includes(d.tipo)) comInscricao.add(d.embarcacao_id);
    const s = situacaoValidade(d.data_validade, hoje);
    if (s === 'vencido') resumo.vencidos++;
    else if (s === 'vence_em_breve') resumo.venceEmBreve++;
    else resumo.emDia++; // em dia ou sem validade
    if (d.data_validade && diasParaVencer(d.data_validade, hoje) <= DIAS_FAIXA_TOPO) resumo.urgentes++;
  }
  resumo.pendentes = (barcos ?? []).filter((b) => !comInscricao.has(b.id)).length;
  return resumo;
}

/** Próximos vencimentos (ativos, com validade), do mais urgente ao mais distante. */
export async function proximosVencimentos(ownerId: string, limite = 4) {
  const { data } = await supabaseAdmin
    .from('documento')
    .select('id, tipo, titulo, data_validade, embarcacao:embarcacao_id ( nome ), membro:equipe_membro_id ( nome_completo, is_gestor )')
    .eq('owner_id', ownerId)
    .is('arquivado_em', null)
    .not('data_validade', 'is', null)
    .order('data_validade', { ascending: true })
    .limit(limite);
  type Linha = {
    id: string;
    tipo: DocumentoTipo;
    titulo: string | null;
    data_validade: string;
    embarcacao: { nome: string } | null;
    membro: { nome_completo: string; is_gestor: boolean } | null;
  };
  return ((data ?? []) as unknown as Linha[]).map((d) => ({
    id: d.id,
    tipo: d.tipo,
    titulo: d.titulo,
    data_validade: d.data_validade,
    alvo: d.embarcacao?.nome ?? (d.membro ? (d.membro.is_gestor ? 'Você' : d.membro.nome_completo) : '—'),
  }));
}

export type AnaliseCondutor =
  | { resultado: 'exato'; motivo: 'cpf' | 'nome'; membro: MembroCondutor }
  | { resultado: 'similar'; candidatos: MembroCondutor[] }
  | { resultado: 'novo' };

/**
 * Procura na equipe o condutor da habilitação (SPEC §95.5): mesmo CPF ou
 * mesmo nome → vínculo automático; nome parecido → candidatos para o gestor
 * confirmar; ninguém → cadastro novo (marinheiro).
 */
export async function analisarCondutor(ownerId: string, nome: string, cpf: string | null): Promise<AnaliseCondutor> {
  const { data } = await supabaseAdmin
    .from('equipe_membro')
    .select('id, nome_completo, is_gestor, funcao, ativo, cpf, telefone')
    .eq('owner_id', ownerId);
  const membros = (data ?? []).map((m) => ({
    membro: {
      id: m.id,
      nome_completo: m.nome_completo,
      is_gestor: m.is_gestor,
      funcao: m.funcao,
      ativo: m.ativo,
      incompleto: !m.is_gestor && (!m.cpf || !m.telefone),
    } satisfies MembroCondutor,
    cpf: m.cpf,
  }));

  if (cpf) {
    const porCpf = membros.find((m) => m.cpf === cpf);
    if (porCpf) return { resultado: 'exato', motivo: 'cpf', membro: porCpf.membro };
  }
  if (!nome.trim()) return { resultado: 'novo' };

  const notas = membros
    .map((m) => ({ m: m.membro, nota: similaridadeNomes(nome, m.membro.nome_completo) }))
    .sort((a, b) => b.nota - a.nota);
  if (notas[0] && notas[0].nota >= SIMILARIDADE_EXATA) return { resultado: 'exato', motivo: 'nome', membro: notas[0].m };
  const candidatos = notas.filter((n) => n.nota >= SIMILARIDADE_SUGESTAO).slice(0, 3).map((n) => n.m);
  return candidatos.length > 0 ? { resultado: 'similar', candidatos } : { resultado: 'novo' };
}
