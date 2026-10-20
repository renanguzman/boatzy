-- ============================================================
-- BUSCA POR DESTINO: posição de reserva no centro do município
--
-- O destino da busca (município escolhido ou "Próximo de mim") filtra por
-- "município exato OU dentro do raio" e ordena pela distância. A distância
-- usava só a coordenada exata — o ponto de saída do roteiro
-- (`roteiro.latitude/longitude`) ou a localização da embarcação
-- (`embarcacao.latitude/longitude`). Quem não marcou o ponto no mapa (o
-- cadastro só AVISA, não obriga) ficava de fora de toda busca por raio — no
-- "Próximo de mim", que não tem município, nunca aparecia. Ex.: roteiro "Ilha
-- do Francês", só com o município (Florianópolis).
--
-- Agora, sem a coordenada exata, vale o centro do município do roteiro/da
-- embarcação (`municipios.latitude/longitude` — todos os 5.571 têm). O resto
-- das duas funções é idêntico às versões vigentes (buscar_roteiros da
-- 20261019; buscar_embarcacoes da 20261012). CREATE OR REPLACE: mesmos
-- parâmetros e retorno, os GRANTs existentes continuam valendo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.buscar_roteiros(
  p_municipio_id              integer DEFAULT NULL,
  p_lat                       numeric DEFAULT NULL,
  p_lng                       numeric DEFAULT NULL,
  p_raio_km                   numeric DEFAULT 50,
  p_data                      date    DEFAULT NULL,
  p_flex                      integer DEFAULT 0,
  p_pessoas                   integer DEFAULT 0,
  p_limit                     integer DEFAULT 24,
  p_offset                    integer DEFAULT 0,
  p_tipo_id                   uuid    DEFAULT NULL,
  p_preco_min                 numeric DEFAULT NULL,
  p_preco_max                 numeric DEFAULT NULL,
  p_duracao_min               numeric DEFAULT NULL,
  p_duracao_max               numeric DEFAULT NULL,
  p_ordenar                   text    DEFAULT NULL,
  p_modelos_preco             text[]  DEFAULT NULL,
  p_comodidade_ids            uuid[]  DEFAULT NULL,
  p_acessorio_ids             uuid[]  DEFAULT NULL,
  p_equipamento_seguranca_ids uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  id                    uuid,
  distancia_km          numeric,
  total                 bigint,
  preco_exibicao        numeric,
  preco_exibicao_modelo text,
  preco_exibicao_data   date
)
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
      r.duracao_horas,
      CASE
        WHEN av.qtd IS NULL THEN NULL::numeric
        ELSE (av.qtd / (av.qtd + 5.0)) * av.media
             + (5.0 / (av.qtd + 5.0)) * mp.valor
      END AS score,
      CASE
        WHEN v_lat IS NOT NULL AND pos.lat_pos IS NOT NULL AND pos.lng_pos IS NOT NULL THEN
          (6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(pos.lat_pos)) *
            cos(radians(pos.lng_pos) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(pos.lat_pos))
          ))))::numeric
        ELSE NULL::numeric
      END AS dist
    FROM public.roteiro r
    LEFT JOIN aval av ON av.ref_id = r.id
    -- Posição para o raio/distância: a coordenada exata (ponto de saída do
    -- roteiro / localização da embarcação) ou, sem ela, o centro do município.
    LEFT JOIN public.municipios mr ON mr.id = r.municipio_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(r.latitude, mr.latitude)   AS lat_pos,
             COALESCE(r.longitude, mr.longitude) AS lng_pos
    ) pos
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
      -- Comodidades/Acessórios/Equipamentos de segurança: atributos da
      -- EMBARCAÇÃO vinculada, não do roteiro — um roteiro sem embarcação
      -- vinculada não atende a nenhum desses filtros (mesma regra do filtro
      -- de pessoas acima).
      AND (
        p_comodidade_ids IS NULL
        OR (
          r.embarcacao_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM unnest(p_comodidade_ids) AS req(comodidade_id)
            WHERE NOT EXISTS (
              SELECT 1 FROM public.embarcacao_comodidades ec
              WHERE ec.embarcacao_id = r.embarcacao_id AND ec.comodidade_id = req.comodidade_id
            )
          )
        )
      )
      AND (
        p_acessorio_ids IS NULL
        OR (
          r.embarcacao_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM unnest(p_acessorio_ids) AS req(acessorio_id)
            WHERE NOT EXISTS (
              SELECT 1 FROM public.embarcacao_acessorios ea
              WHERE ea.embarcacao_id = r.embarcacao_id AND ea.acessorio_id = req.acessorio_id
            )
          )
        )
      )
      AND (
        p_equipamento_seguranca_ids IS NULL
        OR (
          r.embarcacao_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM unnest(p_equipamento_seguranca_ids) AS req(equipamento_seguranca_id)
            WHERE NOT EXISTS (
              SELECT 1 FROM public.embarcacao_equipamentos_seguranca ees
              WHERE ees.embarcacao_id = r.embarcacao_id AND ees.equipamento_seguranca_id = req.equipamento_seguranca_id
            )
          )
        )
      )
      -- Localização (município exato OU dentro do raio); sem centro = sem filtro
      AND (
        v_lat IS NULL
        OR (p_municipio_id IS NOT NULL AND r.municipio_id = p_municipio_id)
        OR (
          pos.lat_pos IS NOT NULL AND pos.lng_pos IS NOT NULL
          AND 6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(pos.lat_pos)) *
            cos(radians(pos.lng_pos) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(pos.lat_pos))
          ))) <= p_raio_km
        )
      )
      -- Disponibilidade: algum dia de (data ± flex) precisa estar reservável —
      -- mesma regra do calendário e do checkout (dias de operação, dias
      -- fechados/abertos, barco fechado, reservas do barco, janela).
      AND (
        p_data IS NULL
        OR EXISTS (
          SELECT 1
          FROM generate_series(p_data - p_flex, p_data + p_flex, interval '1 day') AS g(dia)
          WHERE public.roteiro_dia_reservavel(r.id, g.dia::date)
        )
      )
  ),
  -- Preço que o card exibe (já com a taxa), calculado só para quem passou nos
  -- filtros acima. Faixa de preço sobre esse mesmo valor: o cliente filtra
  -- pelo que vê. Roteiro sem preço não aparece quando há faixa ativa.
  com_preco AS (
    SELECT b.*, pe.preco AS p_exib, pe.modelo AS p_exib_modelo, pe.data AS p_exib_data
      FROM base b
      LEFT JOIN LATERAL public.roteiro_preco_exibicao(b.id, p_data, p_flex) pe ON true
     WHERE (p_preco_min IS NULL OR (pe.preco IS NOT NULL AND pe.preco >= p_preco_min))
       AND (p_preco_max IS NULL OR (pe.preco IS NOT NULL AND pe.preco <= p_preco_max))
  )
  SELECT c.id, c.dist, COUNT(*) OVER () AS total, c.p_exib, c.p_exib_modelo, c.p_exib_data
  FROM com_preco c
  ORDER BY
    CASE WHEN p_ordenar = 'preco_asc'    THEN c.p_exib        END ASC  NULLS LAST,
    CASE WHEN p_ordenar = 'preco_desc'   THEN c.p_exib        END DESC NULLS LAST,
    CASE WHEN p_ordenar = 'duracao_asc'  THEN c.duracao_horas END ASC  NULLS LAST,
    CASE WHEN p_ordenar = 'duracao_desc' THEN c.duracao_horas END DESC NULLS LAST,
    CASE WHEN p_ordenar = 'avaliacao'    THEN c.score         END DESC NULLS LAST,
    CASE WHEN (p_ordenar IS NULL OR p_ordenar = 'relevancia') AND v_lat IS NOT NULL
         THEN c.dist END ASC NULLS LAST,
    c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.buscar_embarcacoes(
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
        WHEN v_lat IS NOT NULL AND pos.lat_pos IS NOT NULL AND pos.lng_pos IS NOT NULL THEN
          (6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(pos.lat_pos)) *
            cos(radians(pos.lng_pos) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(pos.lat_pos))
          ))))::numeric
        ELSE NULL::numeric
      END AS dist
    FROM public.embarcacao e
    LEFT JOIN aval av ON av.ref_id = e.id
    -- Posição para o raio/distância: a coordenada exata (ponto de saída do
    -- roteiro / localização da embarcação) ou, sem ela, o centro do município.
    LEFT JOIN public.municipios me ON me.id = e.municipio_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(e.latitude, me.latitude)   AS lat_pos,
             COALESCE(e.longitude, me.longitude) AS lng_pos
    ) pos
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
          pos.lat_pos IS NOT NULL AND pos.lng_pos IS NOT NULL
          AND 6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(pos.lat_pos)) *
            cos(radians(pos.lng_pos) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(pos.lat_pos))
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

NOTIFY pgrst, 'reload schema';
