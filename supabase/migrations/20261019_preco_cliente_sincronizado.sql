-- ============================================================
-- PREÇO AO CLIENTE SINCRONIZADO (card = detalhe = checkout)
--
-- O card de roteiro (busca, home, favoritos, página da embarcação, mapa)
-- anunciava `roteiro.preco_minimo` — o preço do GESTOR, sem a taxa de
-- serviço —, enquanto o detalhe do roteiro e o checkout mostram e cobram o
-- valor com a taxa ("Cliente paga" no painel). Ex.: Ilha do Francês com
-- R$ 7.999,97 + 15% aparecia como "a partir de R$ 8.000" no card e
-- "a partir de R$ 9.200" no detalhe.
--
-- Regra única a partir daqui — todo preço que o cliente vê é o "Cliente
-- paga": preço do gestor no dia + taxa efetiva do gestor (`get_taxa_usuario`),
-- com a mesma conta de `calcularValoresPedido` (src/lib/pagamentos/valores.ts).
--
--   - Sem data: "a partir de" = menor valor entre os dias RESERVÁVEIS da
--     janela (mesma regra de `roteiro_situacao_dia`, agora também sem os
--     dias ocupados por reserva — o detalhe já os excluía).
--   - Com data (± flex): o menor valor entre os dias reserváveis do
--     intervalo, com a data a que ele se refere.
--
-- A taxa é aplicada na LEITURA (não materializada): se a taxa do gestor
-- mudar ou vencer, o preço exibido muda na hora, sem cron nem trigger.
--
-- Compatível com o código anterior: só cria funções, acrescenta colunas ao
-- retorno de `buscar_roteiros` (mesmos parâmetros) e ajusta o cálculo de
-- `preco_minimo`.
-- ============================================================

-- ============================================================
-- 1) VALOR AO CLIENTE — espelho de calcularValoresPedido
--
-- No TS: itens = arredondarCentavos(preço); comissão = Math.round(itens ×
-- (taxa / 100)) em ponto flutuante; total = itens + comissão. A comissão é
-- calculada em float8 (o mesmo double do JavaScript) com floor(x + 0.5),
-- que é o Math.round do JS — o round() de float8 do Postgres arredonda
-- metade para o par e divergiria em valores ".5".
-- ============================================================

CREATE OR REPLACE FUNCTION public.valor_cliente(p_valor numeric, p_taxa numeric)
RETURNS numeric(10, 2)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_valor IS NULL THEN NULL
    ELSE (
      round(p_valor, 2)
      + floor(round(p_valor, 2)::float8 * (COALESCE(p_taxa, 0)::float8 / 100) + 0.5)::numeric
    )::numeric(10, 2)
  END;
$$;

COMMENT ON FUNCTION public.valor_cliente(numeric, numeric) IS
  'Total que o cliente paga por um preço do gestor: preço + round(preço × taxa%). '
  'Espelho de calcularValoresPedido (src/lib/pagamentos/valores.ts).';

-- ============================================================
-- 2) "A PARTIR DE" AO CLIENTE — campo computado do PostgREST
--
-- Selecionável como coluna: .select('…, preco_minimo_cliente, preco_minimo_modelo').
-- ============================================================

CREATE OR REPLACE FUNCTION public.preco_minimo_cliente(r public.roteiro)
RETURNS numeric(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT public.valor_cliente(r.preco_minimo, public.get_taxa_usuario(r.owner_id));
$$;

COMMENT ON FUNCTION public.preco_minimo_cliente(public.roteiro) IS
  'Campo computado: `preco_minimo` + taxa efetiva do gestor dono — o "a partir de" '
  'que o cliente vê. NULL = roteiro sem preço ("Consulte o preço").';

-- ============================================================
-- 3) PREÇO EXIBIDO — fonte única (com ou sem data)
--
-- Sem data: `preco_minimo_cliente` + `preco_minimo_modelo` (data NULL).
-- Com data: entre os dias de [data − flex, data + flex] em que o roteiro é
-- reservável, o menor valor entre os modelos ativos — Roteiro (preço do dia,
-- só quando há `preco_base`, a mesma condição do card de reserva para
-- oferecer a aba) e Por Diária (valor fixo). Desempate: modelo Roteiro, depois
-- o dia mais próximo da data pedida. Nenhum dia reservável = nenhuma linha.
-- ============================================================

CREATE OR REPLACE FUNCTION public.roteiro_preco_exibicao(
  p_roteiro_id uuid,
  p_data       date    DEFAULT NULL,
  p_flex       integer DEFAULT 0
)
RETURNS TABLE (preco numeric(10, 2), modelo text, data date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'America/Sao_Paulo'
AS $$
DECLARE
  v_r    record;
  v_taxa numeric;
  v_flex integer := LEAST(GREATEST(COALESCE(p_flex, 0), 0), 31);
BEGIN
  SELECT r.owner_id, r.preco_base, r.preco_minimo, r.preco_minimo_modelo,
         r.preco_diaria_ativo, r.preco_diaria_valor
    INTO v_r
    FROM public.roteiro r
   WHERE r.id = p_roteiro_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_taxa := public.get_taxa_usuario(v_r.owner_id);

  IF p_data IS NULL THEN
    IF v_r.preco_minimo IS NULL THEN RETURN; END IF;
    RETURN QUERY
      SELECT public.valor_cliente(v_r.preco_minimo, v_taxa), v_r.preco_minimo_modelo::text, NULL::date;
    RETURN;
  END IF;

  RETURN QUERY
  WITH dias AS (
    SELECT g.dia::date AS dia
      FROM generate_series(p_data - v_flex, p_data + v_flex, interval '1 day') AS g(dia)
     WHERE public.roteiro_situacao_dia(p_roteiro_id, g.dia::date) = 'disponivel'
  ),
  candidatos AS (
    SELECT public.get_preco_roteiro(p_roteiro_id, d.dia) AS valor, 'roteiro'::text AS mod, 1 AS ordem, d.dia
      FROM dias d
     WHERE v_r.preco_base IS NOT NULL
    UNION ALL
    SELECT v_r.preco_diaria_valor, 'diaria'::text, 2, d.dia
      FROM dias d
     WHERE v_r.preco_diaria_ativo IS TRUE AND v_r.preco_diaria_valor IS NOT NULL
  )
  SELECT public.valor_cliente(c.valor, v_taxa), c.mod, c.dia
    FROM candidatos c
   WHERE c.valor IS NOT NULL AND c.valor > 0
   ORDER BY c.valor ASC, c.ordem ASC, abs(c.dia - p_data) ASC, c.dia ASC
   LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.roteiro_preco_exibicao(uuid, date, integer) IS
  'Preço que o cliente vê no card (já com a taxa): sem data, o "a partir de"; com '
  'data ± flex, o menor valor entre os dias reserváveis do intervalo e a data dele.';

-- ============================================================
-- 4) PREÇO MÍNIMO — sem dias ocupados por reserva; modelo Roteiro só com
-- `preco_base`; dia sem preço (0) não conta
--
-- Mesma assinatura e retorno da 20261017. O detalhe do roteiro anuncia o
-- menor total entre os dias DISPONÍVEIS do calendário (sem os reservados); o
-- card passa a anunciar o mesmo. O trigger em `reserva` (seção 5) mantém a
-- coluna em dia quando uma reserva ocupa ou libera um dia.
-- ============================================================

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
  -- Dias que o cliente pode reservar — mesma ordem de `roteiro_situacao_dia`:
  -- não ocupado por reserva (do roteiro ou de qualquer roteiro do barco), barco
  -- não fechado, dia não fechado, e o roteiro opera (ou o gestor abriu o dia).
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
       AND NOT EXISTS (
         SELECT 1 FROM public.reserva rs
          WHERE rs.status IN ('confirmada', 'aguardando_pagamento')
            AND (rs.roteiro_id = p_roteiro_id
                 OR (p_embarcacao_id IS NOT NULL AND rs.embarcacao_id = p_embarcacao_id))
            AND daterange(rs.data_reserva, COALESCE(rs.data_fim_reserva, rs.data_reserva), '[]') @> dias.data
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
  -- Modelo Roteiro só existe para o cliente quando há `preco_base` (o card de
  -- reserva não oferece a aba sem ele); dia com preço 0 aparece como "sem
  -- preço" no calendário do site.
  min_roteiro AS (
    SELECT MIN(pd.valor)::numeric(10, 2) AS valor
      FROM precos_dia pd
     WHERE p_preco_base IS NOT NULL AND pd.valor > 0
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

-- ============================================================
-- 5) RESERVA OCUPA/LIBERA DIA → recalcula o mínimo
--
-- Uma reserva confirmada/aguardando pagamento ocupa o dia (ou o intervalo,
-- no Por Diária) no roteiro e em todos os roteiros do barco — mesma regra de
-- `roteiro_situacao_dia`. Por linha (e não por comando com tabelas de
-- transição) porque o UPDATE precisa de lista de colunas, que o Postgres não
-- aceita junto com tabelas de transição. Reservas inteiramente no passado não
-- mudam o mínimo (ex.: a conclusão automática das vencidas).
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_reserva_preco_minimo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'America/Sao_Paulo'
AS $$
DECLARE
  v_roteiros uuid[] := '{}';
  v_barcos   uuid[] := '{}';
  v_id       uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.status IN ('confirmada', 'aguardando_pagamento')
       AND COALESCE(NEW.data_fim_reserva, NEW.data_reserva) >= CURRENT_DATE THEN
      v_roteiros := v_roteiros || NEW.roteiro_id;
      v_barcos   := v_barcos   || NEW.embarcacao_id;
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.status IN ('confirmada', 'aguardando_pagamento')
       AND COALESCE(OLD.data_fim_reserva, OLD.data_reserva) >= CURRENT_DATE THEN
      v_roteiros := v_roteiros || OLD.roteiro_id;
      v_barcos   := v_barcos   || OLD.embarcacao_id;
    END IF;
  END IF;

  FOR v_id IN
    SELECT r.id FROM public.roteiro r
     WHERE r.id = ANY (v_roteiros) OR r.embarcacao_id = ANY (v_barcos)
  LOOP
    PERFORM public.recalcular_preco_minimo_roteiro(v_id);
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserva_preco_minimo_ins_del ON public.reserva;
CREATE TRIGGER trg_reserva_preco_minimo_ins_del
  AFTER INSERT OR DELETE ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION public.trg_reserva_preco_minimo();

DROP TRIGGER IF EXISTS trg_reserva_preco_minimo_upd ON public.reserva;
CREATE TRIGGER trg_reserva_preco_minimo_upd
  AFTER UPDATE OF status, data_reserva, data_fim_reserva, roteiro_id, embarcacao_id ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION public.trg_reserva_preco_minimo();

-- ============================================================
-- 6) BUSCA — mesmos parâmetros da 20261017; o retorno ganha o preço exibido
-- no card (`preco_exibicao*`), e a faixa de preço e a ordenação por preço
-- passam a usar esse mesmo valor (com data, o valor da data).
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

-- ============================================================
-- 7) GRANTs + recálculo do mínimo com a regra nova
-- ============================================================

GRANT EXECUTE ON FUNCTION public.valor_cliente(numeric, numeric)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preco_minimo_cliente(public.roteiro)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.roteiro_preco_exibicao(uuid, date, integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calcular_preco_minimo_roteiro(
  uuid, uuid, numeric, smallint[], smallint, boolean, numeric, boolean, numeric
) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_roteiros(
  integer, numeric, numeric, numeric, date, integer, integer, integer, integer, uuid,
  numeric, numeric, numeric, numeric, text, text[], uuid[], uuid[], uuid[]
) TO anon, authenticated, service_role;

SELECT public.recalcular_precos_minimos_roteiros();

NOTIFY pgrst, 'reload schema';
