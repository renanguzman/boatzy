-- ============================================================
-- EMBARCAÇÕES MAIS BEM AVALIADAS (home do hotsite)
-- As avaliações são de roteiros (PRD §6.7), mas cada avaliação
-- carrega o embarcacao_id da reserva — agregamos por embarcação.
-- Ranking: média bayesiana (fórmula IMDb) para que "mais
-- avaliações + maior nota" vença uma única nota 5:
--   score = (v/(v+m))·R + (m/(v+m))·C
--   R = média da embarcação, v = nº de avaliações,
--   C = média global da plataforma, m = 5 (peso mínimo).
-- Com p_lat/p_lng, considera apenas embarcações dentro do raio
-- (haversine, mesmo cálculo de buscar_embarcacoes); sem centro,
-- plataforma inteira. Só embarcações ativas e avaliações aprovadas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.embarcacoes_top_avaliadas(
  p_lat     numeric DEFAULT NULL,
  p_lng     numeric DEFAULT NULL,
  p_raio_km numeric DEFAULT 100,
  p_limit   integer DEFAULT 4
)
RETURNS TABLE (id uuid, media numeric, total bigint, score numeric)
LANGUAGE sql
STABLE
AS $$
  WITH aval AS (
    SELECT a.embarcacao_id, avg(a.nota)::numeric AS media, count(*) AS total
    FROM public.avaliacao a
    WHERE a.status = 'aprovada' AND a.embarcacao_id IS NOT NULL
    GROUP BY a.embarcacao_id
  ),
  global AS (
    SELECT avg(nota)::numeric AS media_global
    FROM public.avaliacao
    WHERE status = 'aprovada'
  )
  SELECT
    e.id,
    aval.media,
    aval.total,
    (aval.total / (aval.total + 5.0)) * aval.media
      + (5.0 / (aval.total + 5.0)) * global.media_global AS score
  FROM aval
  JOIN public.embarcacao e ON e.id = aval.embarcacao_id AND e.status = 'ativo'
  CROSS JOIN global
  WHERE (
    p_lat IS NULL OR p_lng IS NULL
    OR (
      e.latitude IS NOT NULL AND e.longitude IS NOT NULL
      AND 6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(e.latitude)) *
        cos(radians(e.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(e.latitude))
      ))) <= p_raio_km
    )
  )
  ORDER BY score DESC, aval.total DESC, aval.media DESC
  LIMIT p_limit;
$$;

-- Leitura pública (a home do hotsite é anônima).
GRANT EXECUTE ON FUNCTION public.embarcacoes_top_avaliadas(
  numeric, numeric, numeric, integer
) TO anon, authenticated, service_role;
