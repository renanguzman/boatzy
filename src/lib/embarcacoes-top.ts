import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

/** Dados de card da embarcação na seção "Mais Bem Avaliadas" (tudo do banco). */
export type EmbarcacaoTopCard = {
  id: string;
  nome: string;
  preco_base: number | null;
  capacidade: number | null;
  tipo: string | null;
  localidade: string | null;
  imagem: string | null;
  media: number;
  total: number;
};

const RAIO_KM = 100;

type RpcRow = { id: string; media: number; total: number; score: number };

async function rpcTopAvaliadas(
  lat: number | null,
  lng: number | null,
  limit: number,
): Promise<RpcRow[]> {
  const { data, error } = await supabaseAdmin.rpc('embarcacoes_top_avaliadas', {
    p_lat: lat,
    p_lng: lng,
    p_raio_km: RAIO_KM,
    p_limit: limit,
  });
  if (error) {
    console.error('[embarcacoes_top_avaliadas] falha na RPC:', error);
    return [];
  }
  return (data ?? []) as RpcRow[];
}

/**
 * Embarcações mais bem avaliadas (avaliações de roteiro agregadas por
 * embarcação, ranking bayesiano — ver migration 20260709b). Com lat/lng,
 * prioriza embarcações num raio de 100 km do usuário e completa com as
 * melhores da plataforma se a região não preencher o limite; sem
 * localização, plataforma inteira.
 */
export async function getEmbarcacoesTopAvaliadas(opts: {
  lat?: number | null;
  lng?: number | null;
  limit?: number;
}): Promise<EmbarcacaoTopCard[]> {
  const limit = opts.limit ?? 4;
  const lat = opts.lat ?? null;
  const lng = opts.lng ?? null;

  let rows = await rpcTopAvaliadas(lat, lng, limit);

  // Região com poucas embarcações avaliadas: completa com o topo da plataforma.
  if (lat != null && lng != null && rows.length < limit) {
    const globais = await rpcTopAvaliadas(null, null, limit);
    const vistos = new Set(rows.map((r) => r.id));
    rows = [...rows, ...globais.filter((g) => !vistos.has(g.id))].slice(0, limit);
  }

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: detalhes, error } = await supabaseAdmin
    .from('embarcacao')
    .select(
      `id, nome, preco_base, capacidade,
       embarcacao_tipo ( nome ),
       municipios ( nome, estados ( uf ) ),
       embarcacao_imagens ( url_imagem, principal )`,
    )
    .in('id', ids);
  if (error) {
    console.error('[embarcacoes-top] falha ao buscar detalhes:', error);
    return [];
  }

  type Detalhe = {
    id: string;
    nome: string;
    preco_base: number | null;
    capacidade: number | null;
    embarcacao_tipo: { nome: string } | null;
    municipios: { nome: string; estados: { uf: string } | null } | null;
    embarcacao_imagens: { url_imagem: string; principal: boolean }[];
  };
  const byId = new Map(((detalhes ?? []) as unknown as Detalhe[]).map((d) => [d.id, d]));

  return rows.flatMap((row) => {
    const d = byId.get(row.id);
    if (!d) return [];
    const imagem =
      (d.embarcacao_imagens.find((i) => i.principal) ?? d.embarcacao_imagens[0])?.url_imagem ??
      null;
    const localidade = d.municipios
      ? d.municipios.estados
        ? `${d.municipios.nome}, ${d.municipios.estados.uf}`
        : d.municipios.nome
      : null;
    return [
      {
        id: d.id,
        nome: d.nome,
        preco_base: d.preco_base,
        capacidade: d.capacidade,
        tipo: d.embarcacao_tipo?.nome ?? null,
        localidade,
        imagem,
        media: Number(row.media),
        total: Number(row.total),
      },
    ];
  });
}

/** Ids de embarcações favoritadas pelo usuário dentre as listadas. */
export async function getFavoritosEmbarcacaoSet(
  userId: string,
  embarcacaoIds: string[],
): Promise<Set<string>> {
  if (embarcacaoIds.length === 0) return new Set();
  const { data } = await supabaseAdmin
    .from('favorito')
    .select('embarcacao_id')
    .eq('user_id', userId)
    .in('embarcacao_id', embarcacaoIds);
  return new Set((data ?? []).map((f) => f.embarcacao_id as string));
}
