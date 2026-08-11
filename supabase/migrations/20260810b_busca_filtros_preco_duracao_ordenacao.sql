-- ============================================================
-- BUSCA: faixa de preço, faixa de duração e ordenação escolhida
-- pelo usuário — em /buscar, nas duas abas (Roteiros e Embarcações).
--
-- Novos parâmetros (todos opcionais, DEFAULT NULL = comportamento
-- anterior preservado):
--   p_preco_min / p_preco_max     numeric — sobre preco_base
--   p_duracao_min / p_duracao_max numeric — horas (1 dia = 24h)
--   p_ordenar                     text    — 'relevancia' (default),
--       'recentes', 'avaliacao', 'preco_asc', 'preco_desc',
--       'duracao_asc', 'duracao_desc'
--
-- 'relevancia' = regra histórica: mais próximos primeiro quando há
-- localização, senão mais recentes. Qualquer ordenação explícita
-- ignora a distância (o usuário pediu outro critério), mantendo
-- created_at DESC como desempate estável para a paginação.
--
-- 'avaliacao' usa a mesma média bayesiana (IMDb) de
-- roteiros_top_avaliados / embarcacoes_top_avaliadas — assim "muitas
-- notas boas" vence "uma única nota 5". Itens sem avaliação vão para
-- o fim (NULLS LAST), não são excluídos.
--
-- Duração na aba Embarcações: a embarcação não tem duração própria —
-- o filtro exige um roteiro ATIVO vinculado dentro da faixa, e a
-- ordenação usa a MENOR duração entre os roteiros ativos dela.
--
-- DROP + CREATE (e não CREATE OR REPLACE) porque a lista de
-- parâmetros muda: sem o DROP o PostgREST veria dois overloads.
-- ============================================================

-- ─────────────────────────── ROTEIROS ───────────────────────────

DROP FUNCTION IF EXISTS public.buscar_roteiros(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid
);

CREATE FUNCTION public.buscar_roteiros(
  p_municipio_id integer DEFAULT NULL,
  p_lat          numeric DEFAULT NULL,
  p_lng          numeric DEFAULT NULL,
  p_raio_km      numeric DEFAULT 50,
  p_data         date    DEFAULT NULL,
  p_flex         integer DEFAULT 0,
  p_pessoas      integer DEFAULT 0,
  p_limit        integer DEFAULT 24,
  p_offset       integer DEFAULT 0,
  p_tipo_id      uuid    DEFAULT NULL,
  p_preco_min    numeric DEFAULT NULL,
  p_preco_max    numeric DEFAULT NULL,
  p_duracao_min  numeric DEFAULT NULL,
  p_duracao_max  numeric DEFAULT NULL,
  p_ordenar      text    DEFAULT NULL
)
RETURNS TABLE (id uuid, distancia_km numeric, total bigint)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_lat := p_lat;
    v_lng := p_lng;
  ELSIF p_municipio_id IS NOT NULL THEN
    SELECT m.latitude, m.longitude INTO v_lat, v_lng
    FROM public.municipios m
    WHERE m.id = p_municipio_id;
  END IF;

  RETURN QUERY
  WITH aval AS (
    SELECT a.roteiro_id AS ref_id, avg(a.nota)::numeric AS media, count(*)::numeric AS qtd
    FROM public.avaliacao a
    WHERE a.status = 'aprovada' AND a.roteiro_id IS NOT NULL
    GROUP BY a.roteiro_id
  ),
  media_plataforma AS (
    SELECT COALESCE(avg(a.nota)::numeric, 0) AS valor
    FROM public.avaliacao a
    WHERE a.status = 'aprovada'
  ),
  base AS (
    SELECT
      r.id,
      r.created_at,
      r.preco_base,
      r.duracao_horas,
      CASE
        WHEN av.qtd IS NULL THEN NULL::numeric
        ELSE (av.qtd / (av.qtd + 5.0)) * av.media
             + (5.0 / (av.qtd + 5.0)) * mp.valor
      END AS score,
      CASE
        WHEN v_lat IS NOT NULL AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN
          (6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(r.latitude)) *
            cos(radians(r.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(r.latitude))
          ))))::numeric
        ELSE NULL::numeric
      END AS dist
    FROM public.roteiro r
    LEFT JOIN aval av ON av.ref_id = r.id
    CROSS JOIN media_plataforma mp
    WHERE r.ativo = true
      -- Tipo de embarcação: a embarcação VINCULADA ao roteiro deve ser do tipo
      AND (
        p_tipo_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.embarcacao e
          WHERE e.id = r.embarcacao_id
            AND e.embarcacao_tipo_id = p_tipo_id
        )
      )
      -- Pessoas: capacidade da embarcação VINCULADA ao roteiro
      AND (
        p_pessoas <= 0
        OR EXISTS (
          SELECT 1 FROM public.embarcacao e
          WHERE e.id = r.embarcacao_id
            AND e.capacidade IS NOT NULL
            AND e.capacidade >= p_pessoas
        )
      )
      -- Faixa de preço (sobre preco_base, o mesmo valor exibido no card).
      -- Roteiro sem preço cadastrado não aparece quando há faixa ativa.
      AND (p_preco_min IS NULL OR (r.preco_base IS NOT NULL AND r.preco_base >= p_preco_min))
      AND (p_preco_max IS NULL OR (r.preco_base IS NOT NULL AND r.preco_base <= p_preco_max))
      -- Faixa de duração, em horas. Roteiro sem duracao_horas não aparece
      -- quando há faixa ativa (mesma regra do filtro de pessoas).
      AND (p_duracao_min IS NULL OR (r.duracao_horas IS NOT NULL AND r.duracao_horas >= p_duracao_min))
      AND (p_duracao_max IS NULL OR (r.duracao_horas IS NOT NULL AND r.duracao_horas <= p_duracao_max))
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
    CASE WHEN p_ordenar = 'preco_asc'    THEN b.preco_base    END ASC  NULLS LAST,
    CASE WHEN p_ordenar = 'preco_desc'   THEN b.preco_base    END DESC NULLS LAST,
    CASE WHEN p_ordenar = 'duracao_asc'  THEN b.duracao_horas END ASC  NULLS LAST,
    CASE WHEN p_ordenar = 'duracao_desc' THEN b.duracao_horas END DESC NULLS LAST,
    CASE WHEN p_ordenar = 'avaliacao'    THEN b.score         END DESC NULLS LAST,
    CASE WHEN (p_ordenar IS NULL OR p_ordenar = 'relevancia') AND v_lat IS NOT NULL
         THEN b.dist END ASC NULLS LAST,
    b.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_roteiros(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid,
  numeric, numeric, numeric, numeric, text
) TO anon, authenticated, service_role;

-- ────────────────────────── EMBARCAÇÕES ─────────────────────────

DROP FUNCTION IF EXISTS public.buscar_embarcacoes(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid
);

CREATE FUNCTION public.buscar_embarcacoes(
  p_municipio_id integer DEFAULT NULL,
  p_lat          numeric DEFAULT NULL,
  p_lng          numeric DEFAULT NULL,
  p_raio_km      numeric DEFAULT 50,
  p_data         date    DEFAULT NULL,
  p_flex         integer DEFAULT 0,
  p_pessoas      integer DEFAULT 0,
  p_limit        integer DEFAULT 24,
  p_offset       integer DEFAULT 0,
  p_tipo_id      uuid    DEFAULT NULL,
  p_preco_min    numeric DEFAULT NULL,
  p_preco_max    numeric DEFAULT NULL,
  p_duracao_min  numeric DEFAULT NULL,
  p_duracao_max  numeric DEFAULT NULL,
  p_ordenar      text    DEFAULT NULL
)
RETURNS TABLE (id uuid, distancia_km numeric, total bigint)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_lat := p_lat;
    v_lng := p_lng;
  ELSIF p_municipio_id IS NOT NULL THEN
    SELECT m.latitude, m.longitude INTO v_lat, v_lng
    FROM public.municipios m
    WHERE m.id = p_municipio_id;
  END IF;

  RETURN QUERY
  WITH aval AS (
    SELECT a.embarcacao_id AS ref_id, avg(a.nota)::numeric AS media, count(*)::numeric AS qtd
    FROM public.avaliacao a
    WHERE a.status = 'aprovada' AND a.embarcacao_id IS NOT NULL
    GROUP BY a.embarcacao_id
  ),
  media_plataforma AS (
    SELECT COALESCE(avg(a.nota)::numeric, 0) AS valor
    FROM public.avaliacao a
    WHERE a.status = 'aprovada'
  ),
  base AS (
    SELECT
      e.id,
      e.created_at,
      e.preco_base,
      -- Menor duração entre os roteiros ativos da embarcação: é o que o
      -- cliente vê como "a partir de" ao abrir /embarcacoes/[id]/roteiros.
      (
        SELECT min(r.duracao_horas)
        FROM public.roteiro r
        WHERE r.embarcacao_id = e.id AND r.ativo = true AND r.duracao_horas IS NOT NULL
      ) AS duracao_horas,
      CASE
        WHEN av.qtd IS NULL THEN NULL::numeric
        ELSE (av.qtd / (av.qtd + 5.0)) * av.media
             + (5.0 / (av.qtd + 5.0)) * mp.valor
      END AS score,
      CASE
        WHEN v_lat IS NOT NULL AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL THEN
          (6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(e.latitude)) *
            cos(radians(e.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(e.latitude))
          ))))::numeric
        ELSE NULL::numeric
      END AS dist
    FROM public.embarcacao e
    LEFT JOIN aval av ON av.ref_id = e.id
    CROSS JOIN media_plataforma mp
    WHERE e.status = 'ativo'
      -- Precisa ter ao menos um roteiro ativo vinculado — senão a
      -- embarcação não tem o que mostrar quando o cliente clicar nela.
      AND EXISTS (
        SELECT 1 FROM public.roteiro r
        WHERE r.embarcacao_id = e.id AND r.ativo = true
      )
      -- Tipo de embarcação
      AND (p_tipo_id IS NULL OR e.embarcacao_tipo_id = p_tipo_id)
      -- Pessoas
      AND (p_pessoas <= 0 OR (e.capacidade IS NOT NULL AND e.capacidade >= p_pessoas))
      -- Faixa de preço (preco_base da embarcação, o valor exibido no card)
      AND (p_preco_min IS NULL OR (e.preco_base IS NOT NULL AND e.preco_base >= p_preco_min))
      AND (p_preco_max IS NULL OR (e.preco_base IS NOT NULL AND e.preco_base <= p_preco_max))
      -- Faixa de duração: precisa existir roteiro ATIVO dela dentro da faixa
      AND (
        (p_duracao_min IS NULL AND p_duracao_max IS NULL)
        OR EXISTS (
          SELECT 1 FROM public.roteiro r
          WHERE r.embarcacao_id = e.id
            AND r.ativo = true
            AND r.duracao_horas IS NOT NULL
            AND (p_duracao_min IS NULL OR r.duracao_horas >= p_duracao_min)
            AND (p_duracao_max IS NULL OR r.duracao_horas <= p_duracao_max)
        )
      )
      -- Localização (município exato OU dentro do raio); sem centro = sem filtro
      AND (
        v_lat IS NULL
        OR (p_municipio_id IS NOT NULL AND e.municipio_id = p_municipio_id)
        OR (
          e.latitude IS NOT NULL AND e.longitude IS NOT NULL
          AND 6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(e.latitude)) *
            cos(radians(e.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(e.latitude))
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
            e.disponibilidade_dias_semana IS NULL
            OR EXTRACT(DOW FROM g.dia)::smallint = ANY (e.disponibilidade_dias_semana)
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.embarcacao_disponibilidade_bloqueio b
            WHERE b.embarcacao_id = e.id AND b.data = g.dia::date
          )
        )
      )
  )
  SELECT b.id, b.dist, COUNT(*) OVER () AS total
  FROM base b
  ORDER BY
    CASE WHEN p_ordenar = 'preco_asc'    THEN b.preco_base    END ASC  NULLS LAST,
    CASE WHEN p_ordenar = 'preco_desc'   THEN b.preco_base    END DESC NULLS LAST,
    CASE WHEN p_ordenar = 'duracao_asc'  THEN b.duracao_horas END ASC  NULLS LAST,
    CASE WHEN p_ordenar = 'duracao_desc' THEN b.duracao_horas END DESC NULLS LAST,
    CASE WHEN p_ordenar = 'avaliacao'    THEN b.score         END DESC NULLS LAST,
    CASE WHEN (p_ordenar IS NULL OR p_ordenar = 'relevancia') AND v_lat IS NOT NULL
         THEN b.dist END ASC NULLS LAST,
    b.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_embarcacoes(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid,
  numeric, numeric, numeric, numeric, text
) TO anon, authenticated, service_role;

-- Índice para a faixa de preço da aba Embarcações.
CREATE INDEX IF NOT EXISTS embarcacao_preco_base_idx
  ON public.embarcacao (preco_base)
  WHERE status = 'ativo' AND preco_base IS NOT NULL;

-- A assinatura das funções mudou: força o PostgREST a reler o schema para não
-- responder PGRST202 ("função não encontrada") com os novos parâmetros.
NOTIFY pgrst, 'reload schema';
