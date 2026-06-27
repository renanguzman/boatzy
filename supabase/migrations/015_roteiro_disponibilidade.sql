-- ============================================================
-- DISPONIBILIDADE DO ROTEIRO
-- Modelo: recorrência semanal (dias que opera) + bloqueio de
-- datas pontuais. Granularidade de dia inteiro. Capacidade
-- exclusiva (1 reserva por dia).
-- ============================================================

-- ── Recorrência semanal ──────────────────────────────────────
-- Dias da semana em que o roteiro opera (0=Dom .. 6=Sáb).
-- NULL ou vazio = sem restrição de dia da semana (disponível
-- todos os dias, sujeito apenas aos bloqueios). Mantém
-- retrocompatibilidade com roteiros já cadastrados.
ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS disponibilidade_dias_semana smallint[]
    CHECK (
      disponibilidade_dias_semana IS NULL
      OR disponibilidade_dias_semana <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
    );

-- ============================================================
-- TABELA DE BLOQUEIOS (datas de exceção indisponíveis)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roteiro_disponibilidade_bloqueio (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id  uuid NOT NULL REFERENCES public.roteiro(id) ON DELETE CASCADE,
  data        date NOT NULL,
  motivo      text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_rdb_roteiro_data UNIQUE (roteiro_id, data)
);

-- ── Índices ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS rdb_roteiro_data_idx
  ON public.roteiro_disponibilidade_bloqueio (roteiro_id, data);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.roteiro_disponibilidade_bloqueio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.roteiro_disponibilidade_bloqueio
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.roteiro_disponibilidade_bloqueio
  FOR SELECT USING (true);

CREATE POLICY "owner_insert" ON public.roteiro_disponibilidade_bloqueio
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid())
  );

CREATE POLICY "owner_delete" ON public.roteiro_disponibilidade_bloqueio
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid())
  );
