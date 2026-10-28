import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { hojeISO } from '@/lib/datas';
import type { DocumentoTipo, EquipeFuncao } from '@/types/supabase';
import { TIPOS_INSCRICAO } from './tipos';
import { situacaoValidade } from './validade';
import { listarDocumentos, type DocumentoItem } from './server';

/**
 * Documentação vista pelo admin (SPEC §95.9). O admin só precisa saber o que já
 * venceu e quem ainda não enviou; "vence em breve" só aparece no filtro próprio.
 *
 * Situação da embarcação (a mais grave vence):
 *  - `vencida`     — algum documento ativo da embarcação passou da validade;
 *  - `nao_enviada` — nenhum documento de inscrição ativo (TIE, TIEM ou PRPM);
 *  - `em_dia`      — tem inscrição e nada vencido.
 * A equipe (habilitações) é informação secundária: não muda a situação da embarcação.
 */
export type SituacaoDocumentacao = 'vencida' | 'nao_enviada' | 'em_dia';

/** Filtros da lista do admin — `vencendo` (até DIAS_ALERTA dias) só quando pedido explicitamente. */
export type FiltroDocumentacao = SituacaoDocumentacao | 'vencendo';
export const FILTROS_DOCUMENTACAO: FiltroDocumentacao[] = ['vencida', 'nao_enviada', 'em_dia', 'vencendo'];

export type DocResumido = { tipo: DocumentoTipo; titulo: string | null; data_validade: string };

export type DocumentacaoEmbarcacao = {
  situacao: SituacaoDocumentacao;
  /** Documentos ativos da embarcação. */
  total: number;
  vencidos: DocResumido[];
  /** Vencem em até DIAS_ALERTA dias (só exibidos com o filtro "vencendo"). */
  vencendo: DocResumido[];
  /** Equipe (gestor + membros vinculados): habilitações vencidas — menos crítico. */
  habilitacoesVencidas: number;
};

type LinhaDoc = { tipo: DocumentoTipo; titulo: string | null; data_validade: string | null; embarcacao_id: string | null };

/**
 * Situação das embarcações informadas (ex.: a página atual da lista) — lê só os
 * documentos delas. Mesma regra das funções SQL `situacao_documentacao` e
 * `documentacao_vencendo` (migration 20261028b), que fazem o filtro no banco.
 */
async function mapaEmbarcacoes(ids: string[]): Promise<Map<string, Omit<DocumentacaoEmbarcacao, 'habilitacoesVencidas'>>> {
  const mapa = new Map<string, Omit<DocumentacaoEmbarcacao, 'habilitacoesVencidas'>>();
  if (ids.length === 0) return mapa;
  const { data } = await supabaseAdmin
    .from('documento')
    .select('tipo, titulo, data_validade, embarcacao_id')
    .eq('escopo', 'embarcacao')
    .is('arquivado_em', null)
    .in('embarcacao_id', ids);

  const hoje = hojeISO();
  const comInscricao = new Set<string>();
  for (const d of (data ?? []) as LinhaDoc[]) {
    if (!d.embarcacao_id) continue;
    const e = mapa.get(d.embarcacao_id) ?? { situacao: 'nao_enviada', total: 0, vencidos: [], vencendo: [] };
    e.total++;
    if (TIPOS_INSCRICAO.includes(d.tipo)) comInscricao.add(d.embarcacao_id);
    const s = situacaoValidade(d.data_validade, hoje);
    const r = { tipo: d.tipo, titulo: d.titulo, data_validade: d.data_validade! };
    if (s === 'vencido') e.vencidos.push(r);
    else if (s === 'vence_em_breve') e.vencendo.push(r);
    mapa.set(d.embarcacao_id, e);
  }
  for (const [id, e] of mapa) {
    e.situacao = e.vencidos.length > 0 ? 'vencida' : comInscricao.has(id) ? 'em_dia' : 'nao_enviada';
    e.vencidos.sort((a, b) => a.data_validade.localeCompare(b.data_validade));
    e.vencendo.sort((a, b) => a.data_validade.localeCompare(b.data_validade));
  }
  return mapa;
}

const SEM_DOCUMENTOS: Omit<DocumentacaoEmbarcacao, 'habilitacoesVencidas'> = {
  situacao: 'nao_enviada', total: 0, vencidos: [], vencendo: [],
};

/**
 * Filtro da lista do admin aplicado NO BANCO, pelos campos calculados do
 * PostgREST (`situacao_documentacao` / `documentacao_vencendo` — migration
 * 20261028b): entra na mesma consulta de status, busca, contagem e paginação.
 */
export function aplicarFiltroDocumentacao<Q extends { filter: (coluna: string, operador: string, valor: unknown) => Q }>(
  query: Q,
  filtro: FiltroDocumentacao,
): Q {
  return filtro === 'vencendo'
    ? query.filter('documentacao_vencendo', 'is', true)
    : query.filter('situacao_documentacao', 'eq', filtro);
}

/** Quantas embarcações em cada filtro — numa passada no banco; `status` null = todas. */
export async function contarDocumentacaoAdmin(status: string | null): Promise<Record<FiltroDocumentacao, number>> {
  const { data, error } = await supabaseAdmin.rpc('contar_documentacao_embarcacoes', { p_status: status });
  if (error) console.error('[documentos] contar_documentacao_embarcacoes:', error);
  const c = data?.[0];
  return {
    vencida: Number(c?.vencida ?? 0),
    nao_enviada: Number(c?.nao_enviada ?? 0),
    em_dia: Number(c?.em_dia ?? 0),
    vencendo: Number(c?.vencendo ?? 0),
  };
}

/** Habilitações ativas vencidas por embarcação: gestor dono + membros ativos vinculados. */
async function habilitacoesVencidasPorEmbarcacao(
  embarcacoes: { id: string; owner_id: string }[],
): Promise<Map<string, number>> {
  const resultado = new Map(embarcacoes.map((e) => [e.id, 0]));
  if (embarcacoes.length === 0) return resultado;
  const ids = embarcacoes.map((e) => e.id);
  const owners = [...new Set(embarcacoes.map((e) => e.owner_id))];

  const [{ data: vinculos }, { data: gestores }] = await Promise.all([
    supabaseAdmin
      .from('equipe_membro_embarcacao')
      .select('embarcacao_id, equipe_membro ( id, ativo, is_gestor )')
      .in('embarcacao_id', ids),
    supabaseAdmin.from('equipe_membro').select('id, owner_id').eq('is_gestor', true).in('owner_id', owners),
  ]);

  // Membros de cada embarcação (o gestor conduz todas as suas).
  const membrosPorEmbarcacao = new Map<string, Set<string>>();
  const gestorDoOwner = new Map((gestores ?? []).map((g) => [g.owner_id, g.id]));
  for (const e of embarcacoes) {
    const s = new Set<string>();
    const g = gestorDoOwner.get(e.owner_id);
    if (g) s.add(g);
    membrosPorEmbarcacao.set(e.id, s);
  }
  type Vinculo = { embarcacao_id: string; equipe_membro: { id: string; ativo: boolean; is_gestor: boolean } | null };
  for (const v of (vinculos ?? []) as unknown as Vinculo[]) {
    if (v.equipe_membro?.ativo) membrosPorEmbarcacao.get(v.embarcacao_id)?.add(v.equipe_membro.id);
  }

  const todos = [...new Set([...membrosPorEmbarcacao.values()].flatMap((s) => [...s]))];
  if (todos.length === 0) return resultado;
  const { data: docs } = await supabaseAdmin
    .from('documento')
    .select('equipe_membro_id, data_validade')
    .eq('escopo', 'condutor')
    .is('arquivado_em', null)
    .in('equipe_membro_id', todos)
    .lt('data_validade', hojeISO());
  const vencidasPorMembro = new Map<string, number>();
  for (const d of docs ?? []) {
    if (d.equipe_membro_id) vencidasPorMembro.set(d.equipe_membro_id, (vencidasPorMembro.get(d.equipe_membro_id) ?? 0) + 1);
  }
  for (const [embId, membros] of membrosPorEmbarcacao) {
    let n = 0;
    for (const m of membros) n += vencidasPorMembro.get(m) ?? 0;
    resultado.set(embId, n);
  }
  return resultado;
}

/** Documentação das embarcações de uma página da lista do admin. */
export async function documentacaoDasEmbarcacoes(
  embarcacoes: { id: string; owner_id: string }[],
): Promise<Map<string, DocumentacaoEmbarcacao>> {
  const [mapa, habilitacoes] = await Promise.all([
    mapaEmbarcacoes(embarcacoes.map((e) => e.id)),
    habilitacoesVencidasPorEmbarcacao(embarcacoes),
  ]);
  return new Map(
    embarcacoes.map((e) => [e.id, { ...(mapa.get(e.id) ?? SEM_DOCUMENTOS), habilitacoesVencidas: habilitacoes.get(e.id) ?? 0 }]),
  );
}

/** Contadores do dashboard do admin. */
export async function resumoDocumentacaoAdmin(): Promise<{ embarcacoesVencidas: number; habilitacoesVencidas: number }> {
  const [contagem, { count }] = await Promise.all([
    contarDocumentacaoAdmin(null),
    supabaseAdmin
      .from('documento')
      .select('id', { count: 'exact', head: true })
      .eq('escopo', 'condutor')
      .is('arquivado_em', null)
      .lt('data_validade', hojeISO()),
  ]);
  const embarcacoesVencidas = contagem.vencida;
  return { embarcacoesVencidas, habilitacoesVencidas: count ?? 0 };
}

// ── Detalhe da embarcação ─────────────────────────────────────────────────────

export type MembroComHabilitacoes = {
  id: string;
  nome_completo: string;
  is_gestor: boolean;
  funcao: EquipeFuncao | null;
  ativo: boolean;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  documentos: DocumentoItem[];
};

/**
 * Documentos e equipe de uma embarcação para a tela de análise do admin:
 * documentos da embarcação (ativos + histórico) e cada condutor — o gestor dono
 * e os membros vinculados — com as habilitações enviadas.
 */
export async function documentacaoDaEmbarcacao(embarcacaoId: string, ownerId: string): Promise<{
  documentos: DocumentoItem[];
  equipe: MembroComHabilitacoes[];
}> {
  const [todos, { data: vinculos }, { data: gestor }] = await Promise.all([
    listarDocumentos(ownerId),
    supabaseAdmin
      .from('equipe_membro_embarcacao')
      .select('equipe_membro ( id, owner_id, nome_completo, is_gestor, funcao, ativo, cpf, telefone, email )')
      .eq('embarcacao_id', embarcacaoId),
    supabaseAdmin
      .from('equipe_membro')
      .select('id, owner_id, nome_completo, is_gestor, funcao, ativo, cpf, telefone, email')
      .eq('owner_id', ownerId)
      .eq('is_gestor', true)
      .maybeSingle(),
  ]);

  type Membro = Omit<MembroComHabilitacoes, 'documentos'> & { owner_id: string };
  const membros: Membro[] = [];
  if (gestor) membros.push(gestor);
  for (const v of (vinculos ?? []) as unknown as { equipe_membro: Membro | null }[]) {
    const m = v.equipe_membro;
    if (m && m.owner_id === ownerId && !m.is_gestor) membros.push(m);
  }
  membros.sort((a, b) => Number(b.is_gestor) - Number(a.is_gestor) || Number(b.ativo) - Number(a.ativo)
    || a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'));

  return {
    documentos: todos.filter((d) => d.escopo === 'embarcacao' && d.embarcacao_id === embarcacaoId),
    equipe: membros.map((m) => ({
      id: m.id,
      nome_completo: m.nome_completo,
      is_gestor: m.is_gestor,
      funcao: m.funcao,
      ativo: m.ativo,
      cpf: m.cpf,
      telefone: m.telefone,
      email: m.email,
      documentos: todos.filter((d) => d.escopo === 'condutor' && d.equipe_membro_id === m.id),
    })),
  };
}

