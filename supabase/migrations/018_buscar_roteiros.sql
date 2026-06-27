-- ============================================================
-- BUSCA DE ROTEIROS (hotsite)
-- Espelha buscar_embarcacoes (017), com uma diferença no filtro
-- de pessoas: a capacidade considerada é a da EMBARCAÇÃO
-- VINCULADA ao roteiro (roteiro.embarcacao_id → embarcacao.
-- capacidade), não o campo roteiro.quantidade_pessoas.
--   • Localização: município exato OU dentro de um raio (km) do
--     centro escolhido (município selecionado ou ponto "perto de
--     mim"). Distância via haversine.
--   • Data: disponibilidade (dias da semana + bloqueios). Com
--     flexibilidade (±N dias), basta um dia livre na janela.
--   • Pessoas: a embarcação vinculada deve ter capacidade >=
--     pessoas. Roteiros sem embarcação vinculada (ou sem
--     capacidade) NÃO aparecem quando o filtro de pessoas está
--     ativo, pois não há como garantir o atendimento ao grupo.
-- Ordena por distância quando há centro; senão, mais recentes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.buscar_roteiros(
  p_municipio_id integer DEFAULT NULL,
  p_lat          numeric DEFAULT NULL,
  p_lng          numeric DEFAULT NULL,
  p_raio_km      numeric DEFAULT 50,
  p_data         date    DEFAULT NULL,
  p_flex         integer DEFAULT 0,
  p_pessoas      integer DEFAULT 0,
  p_limit        integer DEFAULT 24,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (id uuid, distancia_km numeric, total bigint)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
BEGIN
  -- Centro de busca: ponto "perto de mim" tem prioridade; senão usa o município.
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_lat := p_lat;
    v_lng := p_lng;
  ELSIF p_municipio_id IS NOT NULL THEN
    SELECT m.latitude, m.longitude INTO v_lat, v_lng
    FROM public.municipios m
    WHERE m.id = p_municipio_id;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      r.id,
      r.created_at,
      CASE
        WHEN v_lat IS NOT NULL AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN
          6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(r.latitude)) *
            cos(radians(r.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(r.latitude))
          )))
        ELSE NULL
      END AS dist
    FROM public.roteiro r
    WHERE
      -- Pessoas: capacidade da embarcação VINCULADA ao roteiro
      (
        p_pessoas <= 0
        OR EXISTS (
          SELECT 1 FROM public.embarcacao e
          WHERE e.id = r.embarcacao_id
            AND e.capacidade IS NOT NULL
            AND e.capacidade >= p_pessoas
        )
      )
      -- Localização (município exato OU dentro do raio); sem centro = sem filtro
      AND (
        v_lat IS NULL
        OR (p_municipio_id IS NOT NULL AND r.municipio_id = p_municipio_id)
        OR (
          r.latitude IS NOT NULL AND r.longitude IS NOT NULL
          AND 6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(r.latitude)) *
            cos(radians(r.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(r.latitude))
          ))) <= p_raio_km
        )
      )
      -- Disponibilidade: algum dia da janela (data ± flex) precisa estar livre
      AND (
        p_data IS NULL
        OR EXISTS (
          SELECT 1
          FROM generate_series(p_data - p_flex, p_data + p_flex, interval '1 day') AS g(dia)
          WHERE (
            r.disponibilidade_dias_semana IS NULL
            OR EXTRACT(DOW FROM g.dia)::smallint = ANY (r.disponibilidade_dias_semana)
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.roteiro_disponibilidade_bloqueio b
            WHERE b.roteiro_id = r.id AND b.data = g.dia::date
          )
        )
      )
  )
  SELECT b.id, b.dist, COUNT(*) OVER () AS total
  FROM base b
  ORDER BY
    CASE WHEN v_lat IS NOT NULL THEN b.dist END ASC NULLS LAST,
    b.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Leitura pública (a busca do hotsite é anônima).
GRANT EXECUTE ON FUNCTION public.buscar_roteiros(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer
) TO anon, authenticated, service_role;
