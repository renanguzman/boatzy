-- ============================================================
-- PARADAS DO ROTEIRO (pontos intermediários do itinerário)
-- Modelo: o roteiro mantém origem/destino (colunas já existentes
-- em `roteiro`) como partida e chegada; esta tabela guarda os
-- pontos opcionais entre os dois, em ordem, para permitir um
-- itinerário com quantas paradas o gestor quiser (zero, uma ou
-- várias).
-- ============================================================

CREATE TABLE public.roteiro_parada (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id  uuid        NOT NULL REFERENCES public.roteiro(id) ON DELETE CASCADE,
  ordem       integer     NOT NULL,
  nome        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_roteiro_parada_ordem UNIQUE (roteiro_id, ordem)
);

CREATE INDEX roteiro_parada_roteiro_id_idx ON public.roteiro_parada (roteiro_id, ordem);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.roteiro_parada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.roteiro_parada
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.roteiro_parada
  FOR SELECT USING (true);

CREATE POLICY "owner_insert" ON public.roteiro_parada
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid())
  );

CREATE POLICY "owner_delete" ON public.roteiro_parada
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid())
  );
