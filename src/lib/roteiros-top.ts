import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { RoteiroCardData } from '@/app/buscar/_components/RoteiroCard';

/** Dados do card + agregado de avaliações do ranking. */
export type RoteiroTopCard = RoteiroCardData & { media: number; total: number };

const RAIO_KM = 100;

type RpcRow = { id: string; media: number; total: number; score: number };

async function rpcTopAvaliados(
  lat: number | null,
  lng: number | null,
  limit: number,
): Promise<RpcRow[]> {
  const { data, error } = await supabaseAdmin.rpc('roteiros_top_avaliados', {
    p_lat: lat,
    p_lng: lng,
    p_raio_km: RAIO_KM,
    p_limit: limit,
  });
  if (error) {
    console.error('[roteiros_top_avaliados] falha na RPC:', error);
    return [];
  }
  return (data ?? []) as RpcRow[];
}

/**
 * Roteiros mais bem avaliados (ranking bayesiano — ver migration 20260709c).
 * Com lat/lng, prioriza roteiros num raio de 100 km do usuário e completa com
 * os melhores da plataforma se a região não preencher o limite; sem
 * localização, plataforma inteira.
 */
export async function getRoteirosTopAvaliados(opts: {
  lat?: number | null;
  lng?: number | null;
  limit?: number;
}): Promise<RoteiroTopCard[]> {
  const limit = opts.limit ?? 3;
  const lat = opts.lat ?? null;
  const lng = opts.lng ?? null;

  let rows = await rpcTopAvaliados(lat, lng, limit);

  // Região com poucos roteiros avaliados: completa com o topo da plataforma.
  if (lat != null && lng != null && rows.length < limit) {
    const globais = await rpcTopAvaliados(null, null, limit);
    const vistos = new Set(rows.map((r) => r.id));
    rows = [...rows, ...globais.filter((g) => !vistos.has(g.id))].slice(0, limit);
  }

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  // Mesmos campos do card da busca (/buscar), preservando a ordem do ranking.
  const { data: detalhes, error } = await supabaseAdmin
    .from('roteiro')
    .select(
      `id, nome, descricao, quantidade_pessoas, preco_base, duracao,
       municipios ( nome, estados ( uf ) ),
       roteiro_imagens ( url_imagem, principal ),
       embarcacao ( embarcacao_tipo ( nome ) )`,
    )
    .in('id', ids);
  if (error) {
    console.error('[roteiros-top] falha ao buscar detalhes:', error);
    return [];
  }

  const byId = new Map(
    ((detalhes ?? []) as unknown as RoteiroCardData[]).map((d) => [d.id, d]),
  );

  return rows.flatMap((row) => {
    const d = byId.get(row.id);
    if (!d) return [];
    return [{ ...d, media: Number(row.media), total: Number(row.total) }];
  });
}

/** Ids de roteiros favoritados pelo usuário dentre os listados. */
export async function getFavoritosRoteiroSet(
  userId: string,
  roteiroIds: string[],
): Promise<Set<string>> {
  if (roteiroIds.length === 0) return new Set();
  const { data } = await supabaseAdmin
    .from('favorito')
    .select('roteiro_id')
    .eq('user_id', userId)
    .in('roteiro_id', roteiroIds);
  return new Set((data ?? []).flatMap((f) => (f.roteiro_id ? [f.roteiro_id] : [])));
}
