-- ============================================================
-- ROTEIROS MAIS BEM AVALIADOS (home do hotsite)
-- Espelha embarcacoes_top_avaliadas (20260709b), agregando as
-- avaliações por roteiro (avaliacao.roteiro_id).
-- Ranking: média bayesiana (fórmula IMDb) para que "mais
-- avaliações + maior nota" vença uma única nota 5:
--   score = (v/(v+m))·R + (m/(v+m))·C
--   R = média do roteiro, v = nº de avaliações,
--   C = média global da plataforma, m = 5 (peso mínimo).
-- Com p_lat/p_lng, considera apenas roteiros dentro do raio
-- (haversine sobre roteiro.latitude/longitude, mesmo cálculo de
-- buscar_roteiros); sem centro, plataforma inteira. Só roteiros
-- ativos e avaliações aprovadas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.roteiros_top_avaliados(
  p_lat     numeric DEFAULT NULL,
  p_lng     numeric DEFAULT NULL,
  p_raio_km numeric DEFAULT 100,
  p_limit   integer DEFAULT 3
)
RETURNS TABLE (id uuid, media numeric, total bigint, score numeric)
LANGUAGE sql
STABLE
AS $$
  WITH aval AS (
    SELECT a.roteiro_id, avg(a.nota)::numeric AS media, count(*) AS total
    FROM public.avaliacao a
    WHERE a.status = 'aprovada' AND a.roteiro_id IS NOT NULL
    GROUP BY a.roteiro_id
  ),
  global AS (
    SELECT avg(nota)::numeric AS media_global
    FROM public.avaliacao
    WHERE status = 'aprovada'
  )
  SELECT
    r.id,
    aval.media,
    aval.total,
    (aval.total / (aval.total + 5.0)) * aval.media
      + (5.0 / (aval.total + 5.0)) * global.media_global AS score
  FROM aval
  JOIN public.roteiro r ON r.id = aval.roteiro_id AND r.ativo = true
  CROSS JOIN global
  WHERE (
    p_lat IS NULL OR p_lng IS NULL
    OR (
      r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      AND 6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(r.latitude)) *
        cos(radians(r.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(r.latitude))
      ))) <= p_raio_km
    )
  )
  ORDER BY score DESC, aval.total DESC, aval.media DESC
  LIMIT p_limit;
$$;

-- Leitura pública (a home do hotsite é anônima).
GRANT EXECUTE ON FUNCTION public.roteiros_top_avaliados(
  numeric, numeric, numeric, integer
) TO anon, authenticated, service_role;
