-- ============================================================
-- BUSCA: filtro por modelo de cobrança do roteiro
--
-- `buscar_roteiros` ganha `p_modelos_preco text[] DEFAULT NULL` —
-- array com qualquer combinação de 'roteiro' | 'diaria' | 'pessoa'
-- (ver migration 20260907_roteiro_modelos_cobranca.sql). NULL/vazio
-- = sem filtro (comportamento anterior preservado). Um roteiro entra
-- no resultado se tiver PELO MENOS UM dos modelos selecionados
-- ativo — mesmo espírito do filtro de comodidades (OR entre os
-- valores escolhidos).
--
-- Só existe na busca de ROTEIROS: reserva direta de embarcação
-- (`buscar_embarcacoes`) não tem esses modelos (fora de escopo,
-- ver SPEC §33).
--
-- DROP + CREATE (não CREATE OR REPLACE) porque a lista de parâmetros
-- muda — sem o DROP o PostgREST veria dois overloads.
-- ============================================================

DROP FUNCTION IF EXISTS public.buscar_roteiros(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid,
  numeric, numeric, numeric, numeric, text
);

CREATE FUNCTION public.buscar_roteiros(
  p_municipio_id   integer  DEFAULT NULL,
  p_lat            numeric  DEFAULT NULL,
  p_lng            numeric  DEFAULT NULL,
  p_raio_km        numeric  DEFAULT 50,
  p_data           date     DEFAULT NULL,
  p_flex           integer  DEFAULT 0,
  p_pessoas        integer  DEFAULT 0,
  p_limit          integer  DEFAULT 24,
  p_offset         integer  DEFAULT 0,
  p_tipo_id        uuid     DEFAULT NULL,
  p_preco_min      numeric  DEFAULT NULL,
  p_preco_max      numeric  DEFAULT NULL,
  p_duracao_min    numeric  DEFAULT NULL,
  p_duracao_max    numeric  DEFAULT NULL,
  p_ordenar        text     DEFAULT NULL,
  p_modelos_preco  text[]   DEFAULT NULL
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
      -- Modelo de cobrança: pelo menos um dos modelos selecionados precisa
      -- estar ativo no roteiro (OR entre os valores escolhidos).
      AND (
        p_modelos_preco IS NULL
        OR (
          ('roteiro' = ANY(p_modelos_preco) AND r.preco_base IS NOT NULL)
          OR ('diaria'  = ANY(p_modelos_preco) AND r.preco_diaria_ativo)
          OR ('pessoa'  = ANY(p_modelos_preco) AND r.preco_pessoa_ativo)
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
  numeric, numeric, numeric, numeric, text, text[]
) TO anon, authenticated, service_role;

-- A assinatura da função mudou: força o PostgREST a reler o schema para não
-- responder PGRST202 ("função não encontrada") com o novo parâmetro.
NOTIFY pgrst, 'reload schema';
