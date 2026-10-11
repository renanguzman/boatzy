-- Migration: 20261011_acessorios
-- Cria tabela de acessórios e tabela de ligação com embarcações.
-- Mesmo padrão de `comodidade` e `equipamentos_seguranca` (20261010).

-- ============================================================
-- TABELA: acessorios
-- ============================================================

CREATE TABLE IF NOT EXISTS public.acessorios (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  text NOT NULL UNIQUE
);

-- Seeds iniciais
INSERT INTO public.acessorios (nome) VALUES
  ('Prancha de Stand Up Paddle'),
  ('Caiaque'),
  ('Prancha de Surf'),
  ('Boia Rebocável'),
  ('Banana Boat'),
  ('Wakeboard'),
  ('Esqui Aquático'),
  ('Kit de Snorkel'),
  ('Equipamento de Mergulho'),
  ('Vara de Pesca'),
  ('Churrasqueira'),
  ('Cooler / Caixa Térmica'),
  ('Caixa de Som Bluetooth'),
  ('Toalhas'),
  ('Escada de Mergulho'),
  ('Plataforma de Banho'),
  ('Tenda de Sol / Toldo'),
  ('Rede de Descanso'),
  ('Carregador USB'),
  ('Iluminação Subaquática')
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE public.acessorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.acessorios
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.acessorios
  FOR SELECT USING (true);

-- GRANTs obrigatórios (Supabase >= 30/10/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acessorios TO anon, authenticated, service_role;

-- ============================================================
-- TABELA: embarcacao_acessorios
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao_acessorios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id  uuid NOT NULL REFERENCES public.embarcacao(id) ON DELETE CASCADE,
  acessorio_id   uuid NOT NULL REFERENCES public.acessorios(id) ON DELETE CASCADE,
  CONSTRAINT embarcacao_acessorios_unique UNIQUE (embarcacao_id, acessorio_id)
);

CREATE INDEX IF NOT EXISTS ea_embarcacao_idx ON public.embarcacao_acessorios (embarcacao_id);

-- RLS
ALTER TABLE public.embarcacao_acessorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.embarcacao_acessorios
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.embarcacao_acessorios
  FOR SELECT USING (true);

CREATE POLICY "owner_write_own" ON public.embarcacao_acessorios
  FOR INSERT WITH CHECK (
    embarcacao_id IN (
      SELECT id FROM public.embarcacao WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_delete_own" ON public.embarcacao_acessorios
  FOR DELETE USING (
    embarcacao_id IN (
      SELECT id FROM public.embarcacao WHERE owner_id = auth.uid()
    )
  );

-- GRANTs obrigatórios (Supabase >= 30/10/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embarcacao_acessorios TO anon, authenticated, service_role;
