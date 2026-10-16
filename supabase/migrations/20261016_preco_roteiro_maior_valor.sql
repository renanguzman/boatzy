-- ============================================================
-- PREÇO DO ROTEIRO: data específica vence sempre; entre as demais regras
-- vale a de MAIOR PREÇO
--
-- Até aqui a precedência era fixa por tipo: data_fixa > periodo_anual >
-- dia_semana > preco_base (no mesmo tipo, a maior `prioridade`). Um sábado de
-- verão com "Verão = R$ 1.200" e "Fim de semana = R$ 1.800" cobrava R$ 1.200
-- só porque período anual vinha antes de dia da semana.
--
-- Regra nova (etapa Preço do painel, 16/10/2026):
--   1. data_fixa = "Data específica", o preço que o gestor define clicando no
--      dia do calendário de preços. Vence qualquer outra regra, mesmo sendo
--      mais barata. Entre data_fixa sobrepostas: maior `prioridade`, depois
--      maior `valor`.
--   2. Entre as regras recorrentes que valem na data — periodo_anual e
--      dia_semana, de qualquer tipo —, vence a de MAIOR `valor`.
--   3. Nenhuma regra: `preco_base`.
--
-- Recria (CREATE OR REPLACE, mesma assinatura e retorno) as duas funções que
-- aplicam a precedência — `get_preco_roteiro` (preço do dia no card de
-- reserva e no checkout) e `calcular_preco_minimo_roteiro` ("A partir de
-- R$ X") — e recalcula `preco_minimo` de todos os roteiros. O espelho em
-- TypeScript (`resolverPrecoNaData`, src/lib/precos-calendario.ts) segue a
-- mesma regra.
-- ============================================================

-- ============================================================
-- FUNÇÃO: preço efetivo do modelo "Roteiro" (diária única) numa data
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_preco_roteiro(
  p_roteiro_id uuid,
  p_data       date
)
RETURNS numeric(10, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preco numeric(10, 2);
  v_mmdd  integer := EXTRACT(MONTH FROM p_data)::int * 100
                     + EXTRACT(DAY FROM p_data)::int;
BEGIN

  -- ── 1. Data específica: vence sempre ────────────────────────
  SELECT valor INTO v_preco
  FROM   public.roteiro_preco_regra
  WHERE  roteiro_id = p_roteiro_id
    AND  tipo       = 'data_fixa'
    AND  ativo      = true
    AND  p_data BETWEEN data_inicio AND data_fim
  ORDER  BY prioridade DESC, valor DESC
  LIMIT  1;

  IF FOUND THEN RETURN v_preco; END IF;

  -- ── 2. Período anual e dias da semana: vale o maior preço ───
  SELECT MAX(valor) INTO v_preco
  FROM   public.roteiro_preco_regra
  WHERE  roteiro_id = p_roteiro_id
    AND  ativo      = true
    AND  (
      (tipo = 'periodo_anual' AND (
        -- Período dentro do mesmo ano civil.
        (periodo_mes_inicio * 100 + periodo_dia_inicio
           <= periodo_mes_fim * 100 + periodo_dia_fim
         AND v_mmdd BETWEEN
               periodo_mes_inicio * 100 + periodo_dia_inicio
           AND periodo_mes_fim    * 100 + periodo_dia_fim)
        OR
        -- Período que cruza a virada do ano (ex: 01/Dez → 28/Fev).
        (periodo_mes_inicio * 100 + periodo_dia_inicio
           > periodo_mes_fim * 100 + periodo_dia_fim
         AND (v_mmdd >= periodo_mes_inicio * 100 + periodo_dia_inicio
              OR
              v_mmdd <= periodo_mes_fim    * 100 + periodo_dia_fim))
      ))
      OR
      (tipo = 'dia_semana' AND EXTRACT(DOW FROM p_data)::int = ANY(dias_semana))
    );

  IF v_preco IS NOT NULL THEN RETURN v_preco; END IF;

  -- ── 3. preco_base (fallback) ────────────────────────────────
  SELECT preco_base INTO v_preco
  FROM   public.roteiro
  WHERE  id = p_roteiro_id;

  RETURN v_preco;

END;
$$;

COMMENT ON FUNCTION public.get_preco_roteiro(uuid, date) IS
  'Preço do modelo Roteiro na data: data específica (data_fixa) vence sempre; '
  'senão o MAIOR valor entre as regras periodo_anual/dia_semana que valem na '
  'data; senão preco_base. Espelho em TS: resolverPrecoNaData.';

-- ============================================================
-- FUNÇÃO: preço mínimo ("A partir de R$ X")
--
-- Mesma assinatura e retorno da migration 20261010d; muda só o preço de cada
-- dia (`precos_dia`), que passa a seguir a precedência acima.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_preco_minimo_roteiro(
  p_roteiro_id   uuid,
  p_preco_base   numeric,
  p_diaria_ativo boolean,
  p_diaria_valor numeric,
  p_pessoa_ativo boolean,
  p_pessoa_valor numeric
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
    FROM generate_series(CURRENT_DATE, CURRENT_DATE + 365, interval '1 day') AS d
  ),
  -- Preço efetivo do modelo "Roteiro" em cada dia da janela, com a mesma
  -- precedência de get_preco_roteiro: data específica > maior valor entre
  -- periodo_anual/dia_semana > preco_base.
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
              -- Período dentro do mesmo ano civil.
              (rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                 <= rpr.periodo_mes_fim * 100 + rpr.periodo_dia_fim
               AND (EXTRACT(MONTH FROM dias.data)::int * 100
                    + EXTRACT(DAY FROM dias.data)::int)
                   BETWEEN rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                       AND rpr.periodo_mes_fim    * 100 + rpr.periodo_dia_fim)
              OR
              -- Período que cruza a virada do ano (ex: 01/Dez → 28/Fev).
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
    FROM dias
  ),
  min_roteiro AS (
    SELECT MIN(pd.valor)::numeric(10, 2) AS valor FROM precos_dia pd
  ),
  -- Um candidato por modelo ativo. Por Diária e Por Pessoa têm valor fixo (não
  -- variam por data), então entram direto. `ordem` desempata preços iguais
  -- preferindo a oferta mais forte: o barco inteiro (/dia) antes de /pessoa.
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
-- GRANTs + recálculo do "A partir de" com a regra nova
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_preco_roteiro(uuid, date)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calcular_preco_minimo_roteiro(uuid, numeric, boolean, numeric, boolean, numeric)
  TO anon, authenticated, service_role;

SELECT public.recalcular_precos_minimos_roteiros();

NOTIFY pgrst, 'reload schema';
