import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { partesNoFuso } from '@/lib/datas';
import { buildKeyFromUrl, deleteFromR2, ehFotoDePerfilDe } from '@/lib/r2';
import { ehUuid } from '@/lib/upload-imagem-server';
import { primeiroNome, type OperadorPublico } from '@/lib/operador-tipos';
import type { OperadorPerfilConteudo } from '@/types/supabase';

/**
 * Perfil do operador — leitura no servidor (SPEC §99).
 *
 * As páginas públicas leem com `supabaseAdmin` (service role ignora RLS), então o
 * filtro "só a versão aprovada e no ar" mora AQUI e só aqui: `getOperadorPublico`.
 * Nunca selecionar e-mail, telefone, CPF ou endereço do gestor.
 */

export type ResumoOperador = {
  media: number | null;
  totalAvaliacoes: number;
  avaliacoesPendentes: number;
  experiencias: number;
  embarcacoes: number;
  passeiosRealizados: number;
};

const RESUMO_VAZIO: ResumoOperador = {
  media: null, totalAvaliacoes: 0, avaliacoesPendentes: 0, experiencias: 0, embarcacoes: 0, passeiosRealizados: 0,
};

/** Reputação e números de vários operadores numa só chamada (admin lista; site usa 1 id). */
export async function getResumosOperadores(ownerIds: string[]): Promise<Map<string, ResumoOperador>> {
  const mapa = new Map<string, ResumoOperador>();
  const ids = [...new Set(ownerIds.filter(ehUuid))];
  if (ids.length === 0) return mapa;

  const { data, error } = await supabaseAdmin.rpc('operador_resumos_publicos', { p_owners: ids });
  if (error) {
    console.error('[operador] falha ao carregar resumos:', error);
    return mapa;
  }
  for (const r of data ?? []) {
    mapa.set(r.owner_id, {
      media: r.media === null ? null : Number(r.media),
      totalAvaliacoes: r.total_avaliacoes,
      avaliacoesPendentes: r.avaliacoes_pendentes,
      experiencias: r.experiencias_ativas,
      embarcacoes: r.embarcacoes_ativas,
      passeiosRealizados: r.passeios_realizados,
    });
  }
  return mapa;
}

export async function getResumoOperador(ownerId: string): Promise<ResumoOperador> {
  return (await getResumosOperadores([ownerId])).get(ownerId) ?? RESUMO_VAZIO;
}

/** Versão publicada é utilizável? (nome, bio e foto presentes). */
function conteudoPublicavel(c: OperadorPerfilConteudo | null): c is OperadorPerfilConteudo & {
  nome_publico: string; bio: string; foto_url: string;
} {
  return !!c && !!c.nome_publico && !!c.bio && !!c.foto_url;
}

/**
 * Operador para o site: só se houver versão APROVADA e não retirada do ar.
 * Devolve `null` caso contrário — a seção não renderiza e a página do operador dá 404.
 */
export async function getOperadorPublico(ownerId: string | null | undefined): Promise<OperadorPublico | null> {
  if (!ownerId || !ehUuid(ownerId)) return null;

  const { data: perfil } = await supabaseAdmin
    .from('operador_perfil')
    .select('status, publicado')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (!perfil || perfil.status === 'retirado' || !conteudoPublicavel(perfil.publicado)) return null;

  const [{ data: usuario }, resumo] = await Promise.all([
    supabaseAdmin.from('users').select('created_at').eq('id', ownerId).maybeSingle(),
    getResumoOperador(ownerId),
  ]);

  const nome = perfil.publicado.nome_publico;
  return {
    id: ownerId,
    nome,
    primeiroNome: primeiroNome(nome),
    headline: perfil.publicado.headline,
    bio: perfil.publicado.bio,
    fotoUrl: perfil.publicado.foto_url,
    desdeAno: partesNoFuso(usuario?.created_at ? new Date(usuario.created_at) : new Date()).ano,
    media: resumo.media,
    totalAvaliacoes: resumo.totalAvaliacoes,
    experiencias: resumo.experiencias,
    embarcacoes: resumo.embarcacoes,
    passeiosRealizados: resumo.passeiosRealizados,
  };
}

/** Registro completo (rascunho + publicado) — painel do gestor e admin. */
export async function getOperadorPerfil(ownerId: string) {
  const { data } = await supabaseAdmin.from('operador_perfil').select('*').eq('owner_id', ownerId).maybeSingle();
  return data;
}

export type EventoPerfil = {
  id: string;
  tipo: string;
  statusNovo: string;
  observacao: string | null;
  /** Só preenchida quando `incluirInterna` (admin). */
  observacaoInterna: string | null;
  atorPapel: 'gestor' | 'admin';
  criadoEm: string;
};

/** Linha do tempo do perfil. A observação interna só sai para o admin. */
export async function listarEventosPerfil(ownerId: string, opcoes: { incluirInterna: boolean; limite?: number }): Promise<EventoPerfil[]> {
  const { data } = await supabaseAdmin
    .from('operador_perfil_evento')
    .select('id, tipo, status_novo, observacao, observacao_interna, ator_papel, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(opcoes.limite ?? 30);

  return (data ?? []).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    statusNovo: e.status_novo,
    observacao: e.observacao,
    observacaoInterna: opcoes.incluirInterna ? e.observacao_interna : null,
    atorPapel: e.ator_papel,
    criadoEm: e.created_at,
  }));
}

/** Apaga do R2 uma foto de perfil que saiu de uso (só da pasta do próprio operador; falha não derruba a ação). */
export async function apagarFotoPerfil(ownerId: string, url: string | null | undefined): Promise<void> {
  if (!url || !ehFotoDePerfilDe(ownerId, url)) return;
  try {
    await deleteFromR2(buildKeyFromUrl(url));
  } catch (e) {
    console.error('[operador] não foi possível apagar a foto antiga do R2:', e);
  }
}

/** Perfis aguardando a decisão do admin (badge do menu e do dashboard). */
export async function contarPerfisOperadorPendentes(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('operador_perfil')
    .select('owner_id', { count: 'exact', head: true })
    .eq('status', 'em_analise');
  return count ?? 0;
}
