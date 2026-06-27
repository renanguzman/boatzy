-- ============================================================
-- DISPONIBILIDADE DA EMBARCAÇÃO
-- Espelha o modelo de disponibilidade do roteiro (migration 015):
-- recorrência semanal (dias que opera) + bloqueio de datas
-- pontuais. Granularidade de dia inteiro. Capacidade exclusiva
-- (1 reserva por dia).
-- ============================================================

-- ── Recorrência semanal ──────────────────────────────────────
-- Dias da semana em que a embarcação opera (0=Dom .. 6=Sáb).
-- NULL ou vazio = sem restrição de dia da semana (disponível
-- todos os dias, sujeito apenas aos bloqueios). Mantém
-- retrocompatibilidade com embarcações já cadastradas.
ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS disponibilidade_dias_semana smallint[]
    CHECK (
      disponibilidade_dias_semana IS NULL
      OR disponibilidade_dias_semana <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
    );

-- ============================================================
-- TABELA DE BLOQUEIOS (datas de exceção indisponíveis)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao_disponibilidade_bloqueio (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id  uuid NOT NULL REFERENCES public.embarcacao(id) ON DELETE CASCADE,
  data           date NOT NULL,
  motivo         text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_edb_embarcacao_data UNIQUE (embarcacao_id, data)
);

-- ── Índices ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS edb_embarcacao_data_idx
  ON public.embarcacao_disponibilidade_bloqueio (embarcacao_id, data);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.embarcacao_disponibilidade_bloqueio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.embarcacao_disponibilidade_bloqueio
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.embarcacao_disponibilidade_bloqueio
  FOR SELECT USING (true);

CREATE POLICY "owner_insert" ON public.embarcacao_disponibilidade_bloqueio
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.embarcacao e WHERE e.id = embarcacao_id AND e.owner_id = auth.uid())
  );

CREATE POLICY "owner_delete" ON public.embarcacao_disponibilidade_bloqueio
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.embarcacao e WHERE e.id = embarcacao_id AND e.owner_id = auth.uid())
  );
