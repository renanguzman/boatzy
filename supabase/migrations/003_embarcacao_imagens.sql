-- Migration: 003_embarcacao_imagens
-- Adiciona campo data_criacao em embarcacao e cria tabela de imagens

-- ============================================================
-- ALTER TABLE embarcacao
-- ============================================================

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS data_criacao timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- TABELA embarcacao_imagens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao_imagens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id  uuid NOT NULL REFERENCES public.embarcacao(id) ON DELETE CASCADE,
  url_imagem     text NOT NULL,
  titulo         text,
  principal      boolean NOT NULL DEFAULT false,
  data_criacao   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS embarcacao_imagens_embarcacao_id_idx ON public.embarcacao_imagens (embarcacao_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.embarcacao_imagens ENABLE ROW LEVEL SECURITY;

-- Service role: acesso total
CREATE POLICY "service_role_all" ON public.embarcacao_imagens
  FOR ALL USING (true) WITH CHECK (true);

-- Leitura pública (hotsite)
CREATE POLICY "public_read" ON public.embarcacao_imagens
  FOR SELECT USING (true);

-- Owner pode inserir/atualizar/deletar imagens das suas embarcações
CREATE POLICY "owner_write_own" ON public.embarcacao_imagens
  FOR INSERT WITH CHECK (
    embarcacao_id IN (
      SELECT e.id FROM public.embarcacao e
      JOIN public.users u ON u.id = e.owner_id
      WHERE u.id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "owner_update_own" ON public.embarcacao_imagens
  FOR UPDATE USING (
    embarcacao_id IN (
      SELECT e.id FROM public.embarcacao e
      JOIN public.users u ON u.id = e.owner_id
      WHERE u.id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "owner_delete_own" ON public.embarcacao_imagens
  FOR DELETE USING (
    embarcacao_id IN (
      SELECT e.id FROM public.embarcacao e
      JOIN public.users u ON u.id = e.owner_id
      WHERE u.id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );
