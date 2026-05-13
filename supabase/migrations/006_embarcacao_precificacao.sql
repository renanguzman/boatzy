-- Migration: 006_embarcacao_precificacao
-- Estrutura de precificação dinâmica por embarcação.
--
-- CAMADAS DE PREÇO (prioridade decrescente):
--   1. data_fixa     → range de datas únicas, ex: feriado prolongado
--   2. periodo_anual → range anual recorrente (mês/dia), ex: verão todo ano
--   3. dia_semana    → dias da semana recorrentes, ex: sábados e domingos
--   4. preco_base    → valor padrão da embarcação (fallback)
--
-- Quando mais de uma regra do mesmo tipo coincide, vence a de maior prioridade.

-- ============================================================
-- PREÇO BASE — coluna na tabela embarcacao
-- ============================================================

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS preco_base numeric(10, 2)
    CHECK (preco_base IS NULL OR preco_base >= 0);

-- ============================================================
-- TIPO DE REGRA
-- ============================================================

CREATE TYPE preco_regra_tipo AS ENUM (
  'dia_semana',    -- recorrente por dias da semana
  'periodo_anual', -- recorrente por período do ano (mês/dia)
  'data_fixa'      -- datas específicas únicas (one-time)
);

-- ============================================================
-- TABELA DE REGRAS DE PREÇO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao_preco_regra (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id   uuid NOT NULL REFERENCES public.embarcacao(id) ON DELETE CASCADE,

  nome            text NOT NULL,           -- ex: "Fim de Semana", "Verão", "Réveillon 2025"
  valor           numeric(10, 2) NOT NULL
                    CHECK (valor >= 0),
  tipo            preco_regra_tipo NOT NULL,
  prioridade      integer NOT NULL DEFAULT 0,  -- desempate entre regras do mesmo tipo
  ativo           boolean NOT NULL DEFAULT true,

  -- ── tipo = 'dia_semana' ─────────────────────────────────
  -- Array de dias: 0 = domingo … 6 = sábado (padrão POSIX/PostgreSQL DOW)
  dias_semana     integer[],

  -- ── tipo = 'periodo_anual' ──────────────────────────────
  -- Período recorrente todo ano, definido por mês e dia.
  -- Suporta cruzamento de ano (ex: dez → mar para o verão brasileiro).
  periodo_mes_inicio  integer CHECK (periodo_mes_inicio BETWEEN 1 AND 12),
  periodo_dia_inicio  integer CHECK (periodo_dia_inicio BETWEEN 1 AND 31),
  periodo_mes_fim     integer CHECK (periodo_mes_fim    BETWEEN 1 AND 12),
  periodo_dia_fim     integer CHECK (periodo_dia_fim    BETWEEN 1 AND 31),

  -- ── tipo = 'data_fixa' ──────────────────────────────────
  -- Intervalo de datas absolutas (one-time).
  data_inicio     date,
  data_fim        date,
  CONSTRAINT chk_data_fixa_ordem CHECK (
    tipo != 'data_fixa' OR data_inicio <= data_fim
  ),

  -- ── Integridade por tipo ─────────────────────────────────
  CONSTRAINT chk_dia_semana CHECK (
    tipo != 'dia_semana'
    OR (dias_semana IS NOT NULL AND array_length(dias_semana, 1) > 0)
  ),
  CONSTRAINT chk_periodo_anual CHECK (
    tipo != 'periodo_anual'
    OR (
      periodo_mes_inicio IS NOT NULL AND periodo_dia_inicio IS NOT NULL AND
      periodo_mes_fim    IS NOT NULL AND periodo_dia_fim    IS NOT NULL
    )
  ),
  CONSTRAINT chk_data_fixa CHECK (
    tipo != 'data_fixa'
    OR (data_inicio IS NOT NULL AND data_fim IS NOT NULL)
  ),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Índices para busca eficiente ─────────────────────────────

-- Lookup por embarcação + tipo (usado na função de resolução)
CREATE INDEX IF NOT EXISTS epr_embarcacao_tipo_ativo_idx
  ON public.embarcacao_preco_regra (embarcacao_id, tipo, ativo);

-- Aceleração de data_fixa
CREATE INDEX IF NOT EXISTS epr_data_fixa_idx
  ON public.embarcacao_preco_regra (embarcacao_id, data_inicio, data_fim)
  WHERE tipo = 'data_fixa' AND ativo = true;

-- Aceleração de periodo_anual
CREATE INDEX IF NOT EXISTS epr_periodo_anual_idx
  ON public.embarcacao_preco_regra (embarcacao_id, periodo_mes_inicio, periodo_mes_fim)
  WHERE tipo = 'periodo_anual' AND ativo = true;

-- Aceleração de dia_semana (índice GIN no array)
CREATE INDEX IF NOT EXISTS epr_dias_semana_idx
  ON public.embarcacao_preco_regra USING GIN (dias_semana)
  WHERE tipo = 'dia_semana' AND ativo = true;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.embarcacao_preco_regra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.embarcacao_preco_regra
  FOR ALL USING (true) WITH CHECK (true);

-- Owner pode ler, criar e editar regras das suas próprias embarcações
CREATE POLICY "owner_read_own" ON public.embarcacao_preco_regra
  FOR SELECT USING (
    embarcacao_id IN (
      SELECT e.id FROM public.embarcacao e
      JOIN public.users u ON u.id = e.owner_id
      WHERE u.id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "owner_write_own" ON public.embarcacao_preco_regra
  FOR INSERT WITH CHECK (
    embarcacao_id IN (
      SELECT e.id FROM public.embarcacao e
      JOIN public.users u ON u.id = e.owner_id
      WHERE u.id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "owner_update_own" ON public.embarcacao_preco_regra
  FOR UPDATE USING (
    embarcacao_id IN (
      SELECT e.id FROM public.embarcacao e
      JOIN public.users u ON u.id = e.owner_id
      WHERE u.id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "owner_delete_own" ON public.embarcacao_preco_regra
  FOR DELETE USING (
    embarcacao_id IN (
      SELECT e.id FROM public.embarcacao e
      JOIN public.users u ON u.id = e.owner_id
      WHERE u.id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Leitura pública (necessária para exibir preço na busca/hotsite)
CREATE POLICY "public_read" ON public.embarcacao_preco_regra
  FOR SELECT USING (true);

-- ============================================================
-- FUNÇÃO: preço efetivo de uma embarcação em uma data
--
-- Prioridade de resolução:
--   1. data_fixa   (range de datas absolutas)
--   2. periodo_anual (período anual recorrente, suporta cruzamento de ano)
--   3. dia_semana  (dias da semana recorrentes)
--   4. preco_base  (valor padrão da embarcação)
--
-- Dentro do mesmo tipo, vence a regra de maior prioridade.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_preco_embarcacao(
  p_embarcacao_id uuid,
  p_data          date
)
RETURNS numeric(10, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_preco   numeric(10, 2);
  -- data como mmdd inteiro para comparação eficiente em periodo_anual
  v_mmdd    integer := EXTRACT(MONTH FROM p_data)::int * 100
                       + EXTRACT(DAY FROM p_data)::int;
BEGIN

  -- ── 1. data_fixa ────────────────────────────────────────────
  SELECT valor INTO v_preco
  FROM   public.embarcacao_preco_regra
  WHERE  embarcacao_id = p_embarcacao_id
    AND  tipo          = 'data_fixa'
    AND  ativo         = true
    AND  p_data BETWEEN data_inicio AND data_fim
  ORDER  BY prioridade DESC
  LIMIT  1;

  IF FOUND THEN RETURN v_preco; END IF;

  -- ── 2. periodo_anual ────────────────────────────────────────
  -- Suporta dois cenários:
  --   a) Mesmo ano:       inicio_mmdd <= fim_mmdd  (ex: mar → nov)
  --   b) Cruzamento anual: inicio_mmdd > fim_mmdd  (ex: dez → mar — verão BR)
  SELECT valor INTO v_preco
  FROM   public.embarcacao_preco_regra
  WHERE  embarcacao_id = p_embarcacao_id
    AND  tipo          = 'periodo_anual'
    AND  ativo         = true
    AND  (
      -- a) mesmo ano
      (periodo_mes_inicio * 100 + periodo_dia_inicio
         <= periodo_mes_fim * 100 + periodo_dia_fim
       AND v_mmdd BETWEEN
             periodo_mes_inicio * 100 + periodo_dia_inicio
         AND periodo_mes_fim    * 100 + periodo_dia_fim)
      OR
      -- b) cruzamento de ano (ex: dez 1 → mar 31)
      (periodo_mes_inicio * 100 + periodo_dia_inicio
         > periodo_mes_fim * 100 + periodo_dia_fim
       AND (v_mmdd >= periodo_mes_inicio * 100 + periodo_dia_inicio
            OR
            v_mmdd <= periodo_mes_fim    * 100 + periodo_dia_fim))
    )
  ORDER  BY prioridade DESC
  LIMIT  1;

  IF FOUND THEN RETURN v_preco; END IF;

  -- ── 3. dia_semana ───────────────────────────────────────────
  -- DOW: 0 = domingo, 1 = segunda … 6 = sábado
  SELECT valor INTO v_preco
  FROM   public.embarcacao_preco_regra
  WHERE  embarcacao_id = p_embarcacao_id
    AND  tipo          = 'dia_semana'
    AND  ativo         = true
    AND  EXTRACT(DOW FROM p_data)::int = ANY(dias_semana)
  ORDER  BY prioridade DESC
  LIMIT  1;

  IF FOUND THEN RETURN v_preco; END IF;

  -- ── 4. preco_base (fallback) ────────────────────────────────
  SELECT preco_base INTO v_preco
  FROM   public.embarcacao
  WHERE  id = p_embarcacao_id;

  RETURN v_preco;

END;
$$;

-- ============================================================
-- FUNÇÃO: preço para múltiplas embarcações em uma data
-- Útil para a tela de busca/listagem do hotsite.
-- Retorna uma tabela com embarcacao_id e preco_efetivo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_precos_embarcacoes(
  p_embarcacao_ids uuid[],
  p_data           date
)
RETURNS TABLE (embarcacao_id uuid, preco_efetivo numeric(10, 2))
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id,
    public.get_preco_embarcacao(id, p_data)
  FROM public.embarcacao
  WHERE id = ANY(p_embarcacao_ids);
$$;
