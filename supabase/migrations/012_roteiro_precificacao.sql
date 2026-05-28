-- ============================================================
-- PREÇO BASE — coluna na tabela roteiro
-- ============================================================

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS preco_base numeric(10, 2)
    CHECK (preco_base IS NULL OR preco_base >= 0);

-- ============================================================
-- TABELA DE REGRAS DE PREÇO DO ROTEIRO
-- Reutiliza o enum preco_regra_tipo criado em 006.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roteiro_preco_regra (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id  uuid NOT NULL REFERENCES public.roteiro(id) ON DELETE CASCADE,

  nome        text NOT NULL,
  valor       numeric(10, 2) NOT NULL CHECK (valor >= 0),
  tipo        preco_regra_tipo NOT NULL,
  prioridade  integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,

  -- tipo = 'dia_semana'
  dias_semana         integer[],

  -- tipo = 'periodo_anual'
  periodo_mes_inicio  integer CHECK (periodo_mes_inicio BETWEEN 1 AND 12),
  periodo_dia_inicio  integer CHECK (periodo_dia_inicio BETWEEN 1 AND 31),
  periodo_mes_fim     integer CHECK (periodo_mes_fim    BETWEEN 1 AND 12),
  periodo_dia_fim     integer CHECK (periodo_dia_fim    BETWEEN 1 AND 31),

  -- tipo = 'data_fixa'
  data_inicio date,
  data_fim    date,

  CONSTRAINT chk_rpr_data_fixa_ordem CHECK (
    tipo != 'data_fixa' OR data_inicio <= data_fim
  ),
  CONSTRAINT chk_rpr_dia_semana CHECK (
    tipo != 'dia_semana'
    OR (dias_semana IS NOT NULL AND array_length(dias_semana, 1) > 0)
  ),
  CONSTRAINT chk_rpr_periodo_anual CHECK (
    tipo != 'periodo_anual'
    OR (
      periodo_mes_inicio IS NOT NULL AND periodo_dia_inicio IS NOT NULL AND
      periodo_mes_fim    IS NOT NULL AND periodo_dia_fim    IS NOT NULL
    )
  ),
  CONSTRAINT chk_rpr_data_fixa CHECK (
    tipo != 'data_fixa'
    OR (data_inicio IS NOT NULL AND data_fim IS NOT NULL)
  ),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS rpr_roteiro_tipo_ativo_idx
  ON public.roteiro_preco_regra (roteiro_id, tipo, ativo);

CREATE INDEX IF NOT EXISTS rpr_data_fixa_idx
  ON public.roteiro_preco_regra (roteiro_id, data_inicio, data_fim)
  WHERE tipo = 'data_fixa' AND ativo = true;

CREATE INDEX IF NOT EXISTS rpr_periodo_anual_idx
  ON public.roteiro_preco_regra (roteiro_id, periodo_mes_inicio, periodo_mes_fim)
  WHERE tipo = 'periodo_anual' AND ativo = true;

CREATE INDEX IF NOT EXISTS rpr_dias_semana_idx
  ON public.roteiro_preco_regra USING GIN (dias_semana)
  WHERE tipo = 'dia_semana' AND ativo = true;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.roteiro_preco_regra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.roteiro_preco_regra
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.roteiro_preco_regra
  FOR SELECT USING (true);

CREATE POLICY "owner_insert" ON public.roteiro_preco_regra
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid())
  );

CREATE POLICY "owner_update" ON public.roteiro_preco_regra
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid())
  );

CREATE POLICY "owner_delete" ON public.roteiro_preco_regra
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid())
  );
