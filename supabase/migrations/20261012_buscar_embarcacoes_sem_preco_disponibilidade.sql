-- ============================================================
-- BUSCA: embarcação deixa de ter preço e disponibilidade próprios
--
-- Os steps "Preço" e "Disponibilidade" saíram do cadastro de embarcação:
-- preço e disponibilidade vivem só no ROTEIRO (a embarcação não é mais
-- reservada diretamente). `buscar_embarcacoes` parava de fazer sentido
-- filtrando/ordenando por `embarcacao.preco_base` e pela agenda da
-- embarcação (`disponibilidade_dias_semana` + `embarcacao_disponibilidade_bloqueio`),
-- dados que não são mais editados. Esta migration recria a função SEM:
--
--   - p_data / p_flex (filtro de disponibilidade);
--   - p_preco_min / p_preco_max (faixa de preço);
--   - ordenação 'preco_asc' / 'preco_desc' (cai na ordem padrão).
--
-- As colunas/tabelas (`embarcacao.preco_base`,
-- `embarcacao.disponibilidade_dias_semana`, `embarcacao_preco_regra`,
-- `embarcacao_disponibilidade_bloqueio`, função `get_preco_embarcacao`)
-- continuam no banco, sem uso pela aplicação.
--
-- DROP + CREATE porque a lista de parâmetros muda.
-- ============================================================

DROP FUNCTION IF EXISTS public.buscar_embarcacoes(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid,
  numeric, numeric, numeric, numeric, text, uuid[], uuid[], uuid[]
);

CREATE FUNCTION public.buscar_embarcacoes(
  p_municipio_id              integer DEFAULT NULL,
  p_lat                       numeric DEFAULT NULL,
  p_lng                       numeric DEFAULT NULL,
  p_raio_km                   numeric DEFAULT 50,
  p_pessoas                   integer DEFAULT 0,
  p_limit                     integer DEFAULT 24,
  p_offset                    integer DEFAULT 0,
  p_tipo_id                   uuid    DEFAULT NULL,
  p_duracao_min               numeric DEFAULT NULL,
  p_duracao_max               numeric DEFAULT NULL,
  p_ordenar                   text    DEFAULT NULL,
  p_comodidade_ids            uuid[]  DEFAULT NULL,
  p_acessorio_ids             uuid[]  DEFAULT NULL,
  p_equipamento_seguranca_ids uuid[]  DEFAULT NULL
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
      -- Comodidades: a embarcação precisa ter TODAS as selecionadas.
      AND (
        p_comodidade_ids IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p_comodidade_ids) AS req(comodidade_id)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.embarcacao_comodidades ec
            WHERE ec.embarcacao_id = e.id AND ec.comodidade_id = req.comodidade_id
          )
        )
      )
      -- Acessórios: mesma semântica E.
      AND (
        p_acessorio_ids IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p_acessorio_ids) AS req(acessorio_id)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.embarcacao_acessorios ea
            WHERE ea.embarcacao_id = e.id AND ea.acessorio_id = req.acessorio_id
          )
        )
      )
      -- Equipamentos de segurança: mesma semântica E.
      AND (
        p_equipamento_seguranca_ids IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p_equipamento_seguranca_ids) AS req(equipamento_seguranca_id)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.embarcacao_equipamentos_seguranca ees
            WHERE ees.embarcacao_id = e.id AND ees.equipamento_seguranca_id = req.equipamento_seguranca_id
          )
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
  )
  SELECT b.id, b.dist, COUNT(*) OVER () AS total
  FROM base b
  ORDER BY
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
  integer, numeric, numeric, numeric, integer, integer, integer, uuid,
  numeric, numeric, text, uuid[], uuid[], uuid[]
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
