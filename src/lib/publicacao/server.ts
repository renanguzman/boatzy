import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type {
  PapelPublicacao, PublicacaoEntidade, StatusPublicacaoQualquer, TipoEventoPublicacao,
} from './config';

/**
 * Acesso de servidor à pipeline de aprovação (SPEC §45). Toda mudança de
 * status passa por `transicionar_publicacao` no banco — que valida a
 * transição para o papel, trava o registro, atualiza e grava o evento.
 * Quem chama já validou sessão, papel e posse.
 */

export type ResultadoTransicao =
  | { ok: true; tipo: TipoEventoPublicacao }
  | { ok: false; error: string };

/** Traduz os erros levantados pelas funções SQL. */
function mensagemErro(msg: string): string {
  if (msg.includes('transicao_invalida')) return 'Esta mudança de status não é permitida no status atual. Recarregue a página.';
  if (msg.includes('observacao_obrigatoria')) return 'Escreva uma observação para o responsável pelo cadastro.';
  if (msg.includes('status_inalterado')) return 'O registro já está neste status.';
  if (msg.includes('sem_permissao')) return 'Você não tem permissão para alterar este registro.';
  if (msg.includes('registro_nao_encontrado')) return 'Registro não encontrado.';
  return msg;
}

export async function transicionarPublicacao(input: {
  entidade: PublicacaoEntidade;
  id: string;
  para: StatusPublicacaoQualquer;
  atorId: string;
  papel: PapelPublicacao;
  observacao?: string | null;
  observacaoInterna?: string | null;
}): Promise<ResultadoTransicao> {
  const { data, error } = await supabaseAdmin.rpc('transicionar_publicacao', {
    p_entidade: input.entidade,
    p_id: input.id,
    p_para: input.para,
    p_ator_id: input.atorId,
    p_ator_papel: input.papel,
    p_observacao: input.observacao?.trim() || null,
    p_observacao_interna: input.observacaoInterna?.trim() || null,
  });
  if (error || !data) return { ok: false, error: mensagemErro(error?.message ?? 'Erro ao alterar o status.') };
  return { ok: true, tipo: data.tipo as TipoEventoPublicacao };
}

/**
 * Chamar ao fim de toda ação que grava campo sensível (dados principais,
 * fotos, paradas…). Gestor + registro Ativo + campo sensível alterado →
 * volta para análise e retorna os campos. Admin → a edição já nasce
 * aprovada. Falha aqui não desfaz a edição; só é logada.
 */
export async function verificarEdicaoSensivel(
  entidade: PublicacaoEntidade,
  id: string,
  atorId: string,
  papel: PapelPublicacao,
): Promise<string[] | null> {
  const { data, error } = await supabaseAdmin.rpc('publicacao_verificar_edicao', {
    p_entidade: entidade, p_id: id, p_ator_id: atorId, p_ator_papel: papel,
  });
  if (error) {
    console.error(`[publicacao] verificar edição ${entidade} ${id}:`, error.message);
    return null;
  }
  return data && data.length > 0 ? data : null;
}

/** Campos sensíveis que mudaram desde a última aprovação (null = nunca aprovado). */
export async function camposAlteradosDesdeAprovacao(
  entidade: PublicacaoEntidade,
  id: string,
): Promise<string[] | null> {
  const { data } = await supabaseAdmin.rpc('publicacao_campos_alterados', { p_entidade: entidade, p_id: id });
  return data ?? null;
}

export type EventoTimeline = {
  id: string;
  tipo: TipoEventoPublicacao;
  statusAnterior: string | null;
  statusNovo: string;
  observacao: string | null;
  /** Só preenchida quando `incluirInterna` (visão admin). */
  observacaoInterna: string | null;
  camposAlterados: string[] | null;
  atorPapel: 'gestor' | 'admin' | 'sistema';
  /** Nome de quem fez. Para o gestor, ações do admin aparecem como "Equipe Boatzy". */
  atorNome: string | null;
  createdAt: string;
};

const COLUNA_FK: Record<PublicacaoEntidade, 'embarcacao_id' | 'roteiro_id' | 'anuncio_venda_id'> = {
  embarcacao: 'embarcacao_id',
  roteiro: 'roteiro_id',
  anuncio_venda: 'anuncio_venda_id',
};

/** Timeline do registro, do mais recente para o mais antigo. */
export async function listarTimeline(
  entidade: PublicacaoEntidade,
  id: string,
  opcoes: { incluirInterna: boolean },
): Promise<EventoTimeline[]> {
  const { data, error } = await supabaseAdmin
    .from('publicacao_evento')
    .select(`
      id, tipo, status_anterior, status_novo, observacao, observacao_interna,
      campos_alterados, ator_papel, created_at,
      ator:users!publicacao_evento_ator_id_fkey ( name )
    `)
    .eq(COLUNA_FK[entidade], id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error(`[publicacao] timeline ${entidade} ${id}:`, error.message);
    return [];
  }

  return (data ?? []).map(e => {
    const ator = e.ator as unknown as { name: string } | null;
    return {
      id: e.id,
      tipo: e.tipo as TipoEventoPublicacao,
      statusAnterior: e.status_anterior,
      statusNovo: e.status_novo,
      observacao: e.observacao,
      observacaoInterna: opcoes.incluirInterna ? e.observacao_interna : null,
      camposAlterados: e.campos_alterados,
      atorPapel: e.ator_papel,
      atorNome: e.ator_papel === 'admin' && !opcoes.incluirInterna ? 'Equipe Boatzy' : (ator?.name ?? null),
      createdAt: e.created_at,
    };
  });
}

/** Última observação do admin visível ao gestor (para o aviso de Retorno / moderação). */
export async function ultimaDecisaoAdmin(
  entidade: PublicacaoEntidade,
  id: string,
): Promise<{ tipo: TipoEventoPublicacao; observacao: string | null; createdAt: string } | null> {
  const { data } = await supabaseAdmin
    .from('publicacao_evento')
    .select('tipo, observacao, created_at')
    .eq(COLUNA_FK[entidade], id)
    .eq('ator_papel', 'admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { tipo: data.tipo as TipoEventoPublicacao, observacao: data.observacao, createdAt: data.created_at } : null;
}

/** Quantidade de registros aguardando análise (menu e dashboard do admin). */
export async function contarPendentesAnalise(): Promise<Record<PublicacaoEntidade, number>> {
  const contar = async (tabela: 'embarcacao' | 'roteiro' | 'anuncio_venda') => {
    const { count } = await supabaseAdmin
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'em_analise');
    return count ?? 0;
  };
  const [embarcacao, roteiro, anuncio_venda] = await Promise.all([
    contar('embarcacao'), contar('roteiro'), contar('anuncio_venda'),
  ]);
  return { embarcacao, roteiro, anuncio_venda };
}

/** Quantidade por status de uma tabela (abas das listagens do administrator). */
export async function contarPorStatus(
  tabela: 'embarcacao' | 'roteiro' | 'anuncio_venda',
  statuses: StatusPublicacaoQualquer[],
): Promise<Record<string, number>> {
  const contagens = await Promise.all(statuses.map(async st => {
    const { count } = await supabaseAdmin
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('status', st as never);
    return [st, count ?? 0] as const;
  }));
  return Object.fromEntries(contagens);
}
