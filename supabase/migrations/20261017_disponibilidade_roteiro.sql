-- ============================================================
-- DISPONIBILIDADE DO ROTEIRO — calendário único (preço + disponibilidade)
--
-- A etapa "Disponibilidade" do cadastro de roteiro foi absorvida pela etapa
-- "Preço e disponibilidade": o mesmo calendário define o preço e a
-- disponibilidade de cada dia, e o cliente vê esse mesmo calendário na página
-- do roteiro. Esta migration dá ao banco a regra única que o site, o checkout,
-- a busca e o painel passam a seguir:
--
-- 1) `roteiro.janela_reserva_meses` (3, 6, 9 ou 12; padrão 3): até quantos
--    meses à frente o cliente pode reservar. Antes era fixo em 3 para todos.
--
-- 2) `roteiro_disponibilidade_dia` (roteiro, data, disponivel) substitui
--    `roteiro_disponibilidade_bloqueio`:
--      disponivel = false → o gestor FECHOU o dia (o antigo bloqueio);
--      disponivel = true  → o gestor ABRIU um dia fora dos dias de operação
--                           (ex.: feriado numa quarta, num roteiro de fim de semana).
--    Os bloqueios existentes são copiados como `disponivel = false`. A tabela
--    antiga fica sem uso (remover numa migration futura).
--
-- 3) `embarcacao_disponibilidade_bloqueio` (sem uso desde 12/10/2026) volta a
--    valer como "barco fechado": o gestor pode fechar o barco inteiro num dia
--    (manutenção), o que fecha TODOS os roteiros dele.
--
-- 4) Uma embarcação faz UM passeio por dia: reserva confirmada (ou aceita
--    aguardando pagamento) de qualquer roteiro do barco ocupa o dia — ou o
--    intervalo inteiro, no modelo Por Diária — em todos os roteiros dele.
--    Os índices únicos `reserva_*_data_ocupada_uniq` só comparavam o PRIMEIRO
--    dia (`data_reserva`): uma diária de 10 a 12 não impedia outra reserva no
--    dia 11. Viram restrições EXCLUDE por intervalo de datas (btree_gist) —
--    erro 23P01 em vez de 23505.
--
-- 5) `roteiro_situacao_dia` é a fonte única da situação de um dia; em cima
--    dela: `roteiro_calendario` (calendário do site), `roteiro_periodo_indisponivel`
--    (checkout) e `roteiro_dia_reservavel` (busca). O painel usa o espelho em
--    TypeScript (`src/lib/disponibilidade.ts`) só para pré-visualizar o que
--    ainda não foi salvo.
--
-- 6) `calcular_preco_minimo_roteiro` ("A partir de R$ X") passa a olhar só os
--    dias reserváveis dentro da janela do roteiro (antes: 365 dias, sem
--    considerar dias de operação nem fechamentos).
-- ============================================================

-- ============================================================
-- 1) JANELA DE RESERVAS
-- ============================================================

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS janela_reserva_meses smallint NOT NULL DEFAULT 3;

ALTER TABLE public.roteiro DROP CONSTRAINT IF EXISTS chk_roteiro_janela_reserva;
ALTER TABLE public.roteiro
  ADD CONSTRAINT chk_roteiro_janela_reserva CHECK (janela_reserva_meses IN (3, 6, 9, 12));

COMMENT ON COLUMN public.roteiro.janela_reserva_meses IS
  'Até quantos meses à frente o cliente pode reservar (3, 6, 9 ou 12). A data '
  'máxima é hoje (Brasília) + N meses, com o dia ajustado ao fim do mês.';

-- ============================================================
-- 2) DISPONIBILIDADE POR DIA DO ROTEIRO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roteiro_disponibilidade_dia (
  roteiro_id  uuid        NOT NULL REFERENCES public.roteiro(id) ON DELETE CASCADE,
  data        date        NOT NULL,
  disponivel  boolean     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (roteiro_id, data)
);

COMMENT ON TABLE public.roteiro_disponibilidade_dia IS
  'Exceções de disponibilidade do roteiro por data: disponivel=false fecha o '
  'dia; disponivel=true abre um dia fora de disponibilidade_dias_semana.';

ALTER TABLE public.roteiro_disponibilidade_dia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.roteiro_disponibilidade_dia;
CREATE POLICY service_role_all ON public.roteiro_disponibilidade_dia
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS owner_all ON public.roteiro_disponibilidade_dia;
CREATE POLICY owner_all ON public.roteiro_disponibilidade_dia
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roteiro r WHERE r.id = roteiro_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.roteiro r WHERE r.id = roteiro_id AND r.owner_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roteiro_disponibilidade_dia
  TO anon, authenticated, service_role;

-- Bloqueios existentes → dias fechados.
INSERT INTO public.roteiro_disponibilidade_dia (roteiro_id, data, disponivel, created_at)
SELECT b.roteiro_id, b.data, false, b.created_at
  FROM public.roteiro_disponibilidade_bloqueio b
ON CONFLICT (roteiro_id, data) DO NOTHING;

COMMENT ON TABLE public.roteiro_disponibilidade_bloqueio IS
  'OBSOLETA desde 20261017 — substituída por roteiro_disponibilidade_dia '
  '(dados copiados como disponivel=false). Sem uso pela aplicação.';

COMMENT ON TABLE public.embarcacao_disponibilidade_bloqueio IS
  'Barco fechado na data (manutenção etc.): fecha TODOS os roteiros da '
  'embarcação. Editado pelo calendário do roteiro (desde 20261017).';

-- ============================================================
-- 3) UM PASSEIO POR BARCO POR DIA — restrição por intervalo
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

DROP INDEX IF EXISTS public.reserva_embarcacao_data_ocupada_uniq;
DROP INDEX IF EXISTS public.reserva_roteiro_data_ocupada_uniq;

ALTER TABLE public.reserva DROP CONSTRAINT IF EXISTS reserva_embarcacao_periodo_ocupado_excl;
ALTER TABLE public.reserva
  ADD CONSTRAINT reserva_embarcacao_periodo_ocupado_excl EXCLUDE USING gist (
    embarcacao_id WITH =,
    daterange(data_reserva, COALESCE(data_fim_reserva, data_reserva), '[]') WITH &&
  ) WHERE (status IN ('confirmada', 'aguardando_pagamento') AND embarcacao_id IS NOT NULL);

-- Mesmo roteiro, com ou sem embarcação: reserva.embarcacao_id é um snapshot
-- e pode divergir do vínculo atual do roteiro (ver migration 20260721).
ALTER TABLE public.reserva DROP CONSTRAINT IF EXISTS reserva_roteiro_periodo_ocupado_excl;
ALTER TABLE public.reserva
  ADD CONSTRAINT reserva_roteiro_periodo_ocupado_excl EXCLUDE USING gist (
    roteiro_id WITH =,
    daterange(data_reserva, COALESCE(data_fim_reserva, data_reserva), '[]') WITH &&
  ) WHERE (status IN ('confirmada', 'aguardando_pagamento') AND roteiro_id IS NOT NULL);

-- ============================================================
-- 4) SITUAÇÃO DO DIA — fonte única
--
-- Ordem de decisão (a primeira que se aplica):
--   passado       data antes de hoje (Brasília)
--   ocupado       reserva confirmada/aguardando pagamento do roteiro OU de
--                 qualquer roteiro do barco vinculado (intervalo inteiro)
--   barco_fechado o gestor fechou o barco inteiro na data
--   fechado       o gestor fechou o dia neste roteiro
--   nao_opera     dia da semana fora da operação (e o gestor não abriu o dia)
--   fora_janela   depois de hoje + janela_reserva_meses
--   disponivel    o cliente pode reservar
-- ============================================================

CREATE OR REPLACE FUNCTION public.roteiro_situacao_dia(p_roteiro_id uuid, p_data date)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'America/Sao_Paulo'
AS $$
DECLARE
  v_r        record;
  v_override boolean;
BEGIN
  SELECT r.id, r.embarcacao_id, r.disponibilidade_dias_semana AS dias, r.janela_reserva_meses AS janela
    INTO v_r
    FROM public.roteiro r
   WHERE r.id = p_roteiro_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF p_data < CURRENT_DATE THEN RETURN 'passado'; END IF;

  -- `daterange @> data` usa os índices GiST das restrições EXCLUDE acima.
  IF EXISTS (
    SELECT 1 FROM public.reserva rs
     WHERE rs.status IN ('confirmada', 'aguardando_pagamento')
       AND (rs.roteiro_id = p_roteiro_id
            OR (v_r.embarcacao_id IS NOT NULL AND rs.embarcacao_id = v_r.embarcacao_id))
       AND daterange(rs.data_reserva, COALESCE(rs.data_fim_reserva, rs.data_reserva), '[]') @> p_data
  ) THEN
    RETURN 'ocupado';
  END IF;

  IF v_r.embarcacao_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.embarcacao_disponibilidade_bloqueio b
     WHERE b.embarcacao_id = v_r.embarcacao_id AND b.data = p_data
  ) THEN
    RETURN 'barco_fechado';
  END IF;

  SELECT d.disponivel INTO v_override
    FROM public.roteiro_disponibilidade_dia d
   WHERE d.roteiro_id = p_roteiro_id AND d.data = p_data;

  IF v_override IS FALSE THEN RETURN 'fechado'; END IF;

  IF v_override IS DISTINCT FROM TRUE
     AND v_r.dias IS NOT NULL AND cardinality(v_r.dias) > 0
     AND NOT (EXTRACT(DOW FROM p_data)::smallint = ANY (v_r.dias)) THEN
    RETURN 'nao_opera';
  END IF;

  IF p_data > (CURRENT_DATE + make_interval(months => v_r.janela::int))::date THEN
    RETURN 'fora_janela';
  END IF;

  RETURN 'disponivel';
END;
$$;

COMMENT ON FUNCTION public.roteiro_situacao_dia(uuid, date) IS
  'Situação do dia para o roteiro: passado | ocupado | barco_fechado | fechado | '
  'nao_opera | fora_janela | disponivel (NULL = roteiro inexistente). Espelho em '
  'TS: situacaoDoDia (src/lib/disponibilidade.ts).';

-- Calendário do site: situação + preço do modelo Roteiro de cada dia (no
-- máximo 400 dias por chamada).
CREATE OR REPLACE FUNCTION public.roteiro_calendario(p_roteiro_id uuid, p_de date, p_ate date)
RETURNS TABLE (data date, situacao text, preco numeric(10, 2))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'America/Sao_Paulo'
AS $$
  SELECT g.dia::date,
         public.roteiro_situacao_dia(p_roteiro_id, g.dia::date),
         public.get_preco_roteiro(p_roteiro_id, g.dia::date)
    FROM generate_series(p_de, LEAST(p_ate, p_de + 400), interval '1 day') AS g(dia)
   ORDER BY 1;
$$;

-- Checkout: NULL quando o período pode ser reservado; senão a situação do
-- primeiro dia que impede. O dia de saída precisa estar 'disponivel'; nos
-- demais dias de uma reserva Por Diária basta não estar ocupado/fechado
-- (dia fora da operação ou depois da janela não interrompe uma viagem já
-- iniciada — o check-out pode passar da janela).
CREATE OR REPLACE FUNCTION public.roteiro_periodo_indisponivel(p_roteiro_id uuid, p_inicio date, p_fim date)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'America/Sao_Paulo'
AS $$
DECLARE
  v_situacao text;
  v_dia      date;
BEGIN
  IF p_fim IS NULL OR p_fim < p_inicio THEN RETURN 'invalido'; END IF;

  v_situacao := public.roteiro_situacao_dia(p_roteiro_id, p_inicio);
  IF v_situacao IS NULL THEN RETURN 'inexistente'; END IF;
  IF v_situacao <> 'disponivel' THEN RETURN v_situacao; END IF;

  FOR v_dia IN SELECT g::date FROM generate_series(p_inicio + 1, p_fim, interval '1 day') AS g LOOP
    v_situacao := public.roteiro_situacao_dia(p_roteiro_id, v_dia);
    IF v_situacao NOT IN ('disponivel', 'nao_opera', 'fora_janela') THEN RETURN v_situacao; END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Busca: só sim/não (não expõe se o dia está ocupado ou fechado).
CREATE OR REPLACE FUNCTION public.roteiro_dia_reservavel(p_roteiro_id uuid, p_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.roteiro_situacao_dia(p_roteiro_id, p_data) = 'disponivel';
$$;

-- A situação detalhada (ocupado × fechado) fica só para o servidor.
REVOKE ALL ON FUNCTION public.roteiro_situacao_dia(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roteiro_calendario(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roteiro_periodo_indisponivel(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roteiro_situacao_dia(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.roteiro_calendario(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.roteiro_periodo_indisponivel(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.roteiro_dia_reservavel(uuid, date) TO anon, authenticated, service_role;

-- ============================================================
-- 5) BUSCA — mesma regra de disponibilidade (antes: só dias da semana e
-- bloqueios; ignorava reservas, o barco compartilhado e a janela)
-- ============================================================

DROP FUNCTION IF EXISTS public.buscar_roteiros(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid,
  numeric, numeric, numeric, numeric, text, text[], uuid[], uuid[], uuid[]
);

CREATE FUNCTION public.buscar_roteiros(
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
      r.preco_minimo,
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
      -- Faixa de preço sobre `preco_minimo`, o mesmo valor que o card anuncia
      -- como "A partir de". Roteiro sem preço cadastrado não aparece quando há
      -- faixa ativa.
      AND (p_preco_min IS NULL OR (r.preco_minimo IS NOT NULL AND r.preco_minimo >= p_preco_min))
      AND (p_preco_max IS NULL OR (r.preco_minimo IS NOT NULL AND r.preco_minimo <= p_preco_max))
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
          r.latitude IS NOT NULL AND r.longitude IS NOT NULL
          AND 6371 * acos(LEAST(1, GREATEST(-1,
            cos(radians(v_lat)) * cos(radians(r.latitude)) *
            cos(radians(r.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(r.latitude))
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
  )
  SELECT b.id, b.dist, COUNT(*) OVER () AS total
  FROM base b
  ORDER BY
    CASE WHEN p_ordenar = 'preco_asc'    THEN b.preco_minimo  END ASC  NULLS LAST,
    CASE WHEN p_ordenar = 'preco_desc'   THEN b.preco_minimo  END DESC NULLS LAST,
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
  numeric, numeric, numeric, numeric, text, text[], uuid[], uuid[], uuid[]
) TO anon, authenticated, service_role;

-- ============================================================
-- 6) PREÇO MÍNIMO ("A partir de R$ X") — só dias reserváveis da janela
--
-- Nova assinatura (recebe barco, dias de operação e janela): no trigger
-- BEFORE de `roteiro` a linha nova ainda não está na tabela. Reservas não
-- entram — o "a partir de" não oscila a cada reserva confirmada.
-- ============================================================

DROP FUNCTION IF EXISTS public.calcular_preco_minimo_roteiro(uuid, numeric, boolean, numeric, boolean, numeric);

CREATE OR REPLACE FUNCTION public.calcular_preco_minimo_roteiro(
  p_roteiro_id    uuid,
  p_embarcacao_id uuid,
  p_preco_base    numeric,
  p_dias_semana   smallint[],
  p_janela_meses  smallint,
  p_diaria_ativo  boolean,
  p_diaria_valor  numeric,
  p_pessoa_ativo  boolean,
  p_pessoa_valor  numeric
)
RETURNS TABLE (preco numeric(10, 2), modelo text, preco_roteiro numeric(10, 2))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'America/Sao_Paulo'
AS $$
  WITH dias AS (
    SELECT d::date AS data
    FROM generate_series(
      CURRENT_DATE,
      (CURRENT_DATE + make_interval(months => COALESCE(p_janela_meses, 3)::int))::date,
      interval '1 day'
    ) AS d
  ),
  -- Dias que o cliente pode reservar: o roteiro opera (ou o gestor abriu o
  -- dia) e nem o dia nem o barco foram fechados.
  reservaveis AS (
    SELECT dias.data
      FROM dias
      LEFT JOIN public.roteiro_disponibilidade_dia rdd
             ON rdd.roteiro_id = p_roteiro_id AND rdd.data = dias.data
     WHERE rdd.disponivel IS DISTINCT FROM false
       AND (rdd.disponivel IS TRUE
            OR p_dias_semana IS NULL
            OR cardinality(p_dias_semana) = 0
            OR EXTRACT(DOW FROM dias.data)::smallint = ANY (p_dias_semana))
       AND NOT EXISTS (
         SELECT 1 FROM public.embarcacao_disponibilidade_bloqueio b
          WHERE b.embarcacao_id = p_embarcacao_id AND b.data = dias.data
       )
  ),
  -- Preço efetivo de cada dia, com a precedência de get_preco_roteiro (data
  -- específica > maior valor entre periodo_anual/dia_semana > preco_base).
  precos_dia AS (
    SELECT COALESCE(
      (SELECT rpr.valor
         FROM public.roteiro_preco_regra rpr
        WHERE rpr.roteiro_id = p_roteiro_id
          AND rpr.tipo  = 'data_fixa'
          AND rpr.ativo = true
          AND dias.data BETWEEN rpr.data_inicio AND rpr.data_fim
        ORDER BY rpr.prioridade DESC, rpr.valor DESC
        LIMIT 1),
      (SELECT MAX(rpr.valor)
         FROM public.roteiro_preco_regra rpr
        WHERE rpr.roteiro_id = p_roteiro_id
          AND rpr.ativo = true
          AND (
            (rpr.tipo = 'periodo_anual' AND (
              (rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                 <= rpr.periodo_mes_fim * 100 + rpr.periodo_dia_fim
               AND (EXTRACT(MONTH FROM dias.data)::int * 100
                    + EXTRACT(DAY FROM dias.data)::int)
                   BETWEEN rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                       AND rpr.periodo_mes_fim    * 100 + rpr.periodo_dia_fim)
              OR
              (rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                 > rpr.periodo_mes_fim * 100 + rpr.periodo_dia_fim
               AND ((EXTRACT(MONTH FROM dias.data)::int * 100
                     + EXTRACT(DAY FROM dias.data)::int)
                      >= rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                    OR
                    (EXTRACT(MONTH FROM dias.data)::int * 100
                     + EXTRACT(DAY FROM dias.data)::int)
                      <= rpr.periodo_mes_fim * 100 + rpr.periodo_dia_fim))
            ))
            OR
            (rpr.tipo = 'dia_semana'
             AND EXTRACT(DOW FROM dias.data)::int = ANY(rpr.dias_semana))
          )),
      p_preco_base
    ) AS valor
    FROM reservaveis dias
  ),
  min_roteiro AS (
    SELECT MIN(pd.valor)::numeric(10, 2) AS valor FROM precos_dia pd
  ),
  -- Um candidato por modelo ativo. Por Diária e Por Pessoa têm valor fixo.
  -- `ordem` desempata preços iguais preferindo o barco inteiro (/dia).
  candidatos AS (
    SELECT (SELECT valor FROM min_roteiro) AS preco, 'roteiro'::text AS modelo, 1 AS ordem
    UNION ALL
    SELECT p_diaria_valor::numeric(10, 2), 'diaria'::text, 2
     WHERE p_diaria_ativo IS TRUE AND p_diaria_valor IS NOT NULL
    UNION ALL
    SELECT p_pessoa_valor::numeric(10, 2), 'pessoa'::text, 3
     WHERE p_pessoa_ativo IS TRUE AND p_pessoa_valor IS NOT NULL
  )
  SELECT c.preco, c.modelo, (SELECT valor FROM min_roteiro)
    FROM candidatos c
   WHERE c.preco IS NOT NULL
   ORDER BY c.preco ASC, c.ordem ASC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.recalcular_preco_minimo_roteiro(p_roteiro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r          record;
  v_preco      numeric(10, 2);
  v_modelo     text;
  v_so_roteiro numeric(10, 2);
BEGIN
  SELECT embarcacao_id, preco_base, disponibilidade_dias_semana, janela_reserva_meses,
         preco_diaria_ativo, preco_diaria_valor, preco_pessoa_ativo, preco_pessoa_valor
    INTO v_r
    FROM public.roteiro
   WHERE id = p_roteiro_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT c.preco, c.modelo, c.preco_roteiro
    INTO v_preco, v_modelo, v_so_roteiro
  FROM public.calcular_preco_minimo_roteiro(
    p_roteiro_id, v_r.embarcacao_id, v_r.preco_base,
    v_r.disponibilidade_dias_semana, v_r.janela_reserva_meses,
    v_r.preco_diaria_ativo, v_r.preco_diaria_valor,
    v_r.preco_pessoa_ativo, v_r.preco_pessoa_valor
  ) AS c;

  UPDATE public.roteiro
     SET preco_minimo         = v_preco,
         preco_minimo_modelo  = v_modelo,
         preco_minimo_roteiro = v_so_roteiro
   WHERE id = p_roteiro_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_roteiro_preco_minimo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_preco      numeric(10, 2);
  v_modelo     text;
  v_so_roteiro numeric(10, 2);
BEGIN
  SELECT c.preco, c.modelo, c.preco_roteiro
    INTO v_preco, v_modelo, v_so_roteiro
  FROM public.calcular_preco_minimo_roteiro(
    NEW.id, NEW.embarcacao_id, NEW.preco_base,
    NEW.disponibilidade_dias_semana, NEW.janela_reserva_meses,
    NEW.preco_diaria_ativo, NEW.preco_diaria_valor,
    NEW.preco_pessoa_ativo, NEW.preco_pessoa_valor
  ) AS c;

  NEW.preco_minimo         := v_preco;
  NEW.preco_minimo_modelo  := v_modelo;
  NEW.preco_minimo_roteiro := v_so_roteiro;
  RETURN NEW;
END;
$$;

-- `UPDATE OF` evita reentrância: o UPDATE de preco_minimo feito pelos
-- triggers abaixo não dispara este.
DROP TRIGGER IF EXISTS trg_roteiro_preco_minimo ON public.roteiro;
CREATE TRIGGER trg_roteiro_preco_minimo
  BEFORE INSERT OR UPDATE OF
    preco_base, preco_diaria_ativo, preco_diaria_valor,
    preco_pessoa_ativo, preco_pessoa_valor,
    disponibilidade_dias_semana, janela_reserva_meses, embarcacao_id
  ON public.roteiro
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_roteiro_preco_minimo();

-- Dias fechados/abertos do roteiro mudam o mínimo. Gatilho por COMANDO (com
-- tabelas de transição): salvar o calendário grava muitas linhas de uma vez
-- e o mínimo é recalculado uma vez por roteiro, não por linha.
CREATE OR REPLACE FUNCTION public.trg_roteiro_disponibilidade_dia_preco_minimo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_id IN SELECT DISTINCT roteiro_id FROM novas LOOP
      PERFORM public.recalcular_preco_minimo_roteiro(v_id);
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOR v_id IN SELECT DISTINCT roteiro_id FROM antigas LOOP
      PERFORM public.recalcular_preco_minimo_roteiro(v_id);
    END LOOP;
  ELSE
    FOR v_id IN SELECT roteiro_id FROM novas UNION SELECT roteiro_id FROM antigas LOOP
      PERFORM public.recalcular_preco_minimo_roteiro(v_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rdd_preco_minimo_ins ON public.roteiro_disponibilidade_dia;
CREATE TRIGGER trg_rdd_preco_minimo_ins
  AFTER INSERT ON public.roteiro_disponibilidade_dia
  REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_roteiro_disponibilidade_dia_preco_minimo();

DROP TRIGGER IF EXISTS trg_rdd_preco_minimo_upd ON public.roteiro_disponibilidade_dia;
CREATE TRIGGER trg_rdd_preco_minimo_upd
  AFTER UPDATE ON public.roteiro_disponibilidade_dia
  REFERENCING OLD TABLE AS antigas NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_roteiro_disponibilidade_dia_preco_minimo();

DROP TRIGGER IF EXISTS trg_rdd_preco_minimo_del ON public.roteiro_disponibilidade_dia;
CREATE TRIGGER trg_rdd_preco_minimo_del
  AFTER DELETE ON public.roteiro_disponibilidade_dia
  REFERENCING OLD TABLE AS antigas
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_roteiro_disponibilidade_dia_preco_minimo();

-- Barco fechado muda o mínimo de todos os roteiros do barco.
CREATE OR REPLACE FUNCTION public.trg_embarcacao_bloqueio_preco_minimo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_id IN SELECT r.id FROM public.roteiro r WHERE r.embarcacao_id IN (SELECT embarcacao_id FROM novas) LOOP
      PERFORM public.recalcular_preco_minimo_roteiro(v_id);
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOR v_id IN SELECT r.id FROM public.roteiro r WHERE r.embarcacao_id IN (SELECT embarcacao_id FROM antigas) LOOP
      PERFORM public.recalcular_preco_minimo_roteiro(v_id);
    END LOOP;
  ELSE
    FOR v_id IN SELECT r.id FROM public.roteiro r
                 WHERE r.embarcacao_id IN (SELECT embarcacao_id FROM novas UNION SELECT embarcacao_id FROM antigas) LOOP
      PERFORM public.recalcular_preco_minimo_roteiro(v_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_edb_preco_minimo_ins ON public.embarcacao_disponibilidade_bloqueio;
CREATE TRIGGER trg_edb_preco_minimo_ins
  AFTER INSERT ON public.embarcacao_disponibilidade_bloqueio
  REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_embarcacao_bloqueio_preco_minimo();

DROP TRIGGER IF EXISTS trg_edb_preco_minimo_upd ON public.embarcacao_disponibilidade_bloqueio;
CREATE TRIGGER trg_edb_preco_minimo_upd
  AFTER UPDATE ON public.embarcacao_disponibilidade_bloqueio
  REFERENCING OLD TABLE AS antigas NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_embarcacao_bloqueio_preco_minimo();

DROP TRIGGER IF EXISTS trg_edb_preco_minimo_del ON public.embarcacao_disponibilidade_bloqueio;
CREATE TRIGGER trg_edb_preco_minimo_del
  AFTER DELETE ON public.embarcacao_disponibilidade_bloqueio
  REFERENCING OLD TABLE AS antigas
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_embarcacao_bloqueio_preco_minimo();

-- ============================================================
-- GRANTs + recálculo
-- ============================================================

GRANT EXECUTE ON FUNCTION public.calcular_preco_minimo_roteiro(
  uuid, uuid, numeric, smallint[], smallint, boolean, numeric, boolean, numeric
) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_preco_minimo_roteiro(uuid) TO service_role;

SELECT public.recalcular_precos_minimos_roteiros();

NOTIFY pgrst, 'reload schema';
