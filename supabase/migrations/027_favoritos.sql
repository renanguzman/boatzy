-- ============================================================
-- Favoritos (cliente → roteiro).
-- O usuário logado favorita roteiros no detalhe (/roteiros/[id])
-- e os visualiza em /favoritos (item "Favoritos" no menu do
-- usuário). Um favorito por par usuário↔roteiro (UNIQUE).
-- A escrita roda na server action alternarFavorito (supabaseAdmin,
-- valida sessão); a RLS é uma segunda camada.
-- ============================================================

CREATE TABLE public.favorito (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  roteiro_id uuid NOT NULL REFERENCES public.roteiro(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, roteiro_id)
);

CREATE INDEX favorito_user_idx ON public.favorito (user_id, created_at DESC);

ALTER TABLE public.favorito ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON public.favorito
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cada usuário enxerga e gerencia apenas os próprios favoritos.
CREATE POLICY dono_select ON public.favorito
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY dono_insert ON public.favorito
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY dono_delete ON public.favorito
  FOR DELETE TO authenticated USING (user_id = auth.uid());
