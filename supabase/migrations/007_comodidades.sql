-- Migration: 007_comodidades
-- Cria tabela de comodidades e tabela de ligação com embarcações.

-- ============================================================
-- TABELA: comodidade
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comodidade (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  text NOT NULL UNIQUE
);

-- Seeds iniciais
INSERT INTO public.comodidade (nome) VALUES
  ('Ar-Condicionado'),
  ('Barco de Apoio'),
  ('Churrasqueira'),
  ('Cozinha Completa'),
  ('Caiaque'),
  ('Cadeira de Praia'),
  ('Mesa de Ping Pong'),
  ('Paddle Board'),
  ('Banheira de Hidromassagem'),
  ('TV com Satélite'),
  ('Internet WiFi'),
  ('Som Ambiente'),
  ('Prancha de Stand Up'),
  ('Tapete inflável'),
  ('Equipamento de Mergulho'),
  ('Geladeira'),
  ('Micro-ondas'),
  ('Deck para Sol'),
  ('Mesa de Jantar'), 
  ('Frigobar'),
  ('Máquina de Café'),
  ('Banheiro a bordo'),
  ('Toldo/Cobertura'),
  ('GPS Náutico'),
  ('Salva-vidas completo')
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE public.comodidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.comodidade
  FOR ALL USING (true) WITH CHECK (true);

-- Leitura pública (hotsite e painel)
CREATE POLICY "public_read" ON public.comodidade
  FOR SELECT USING (true);

-- ============================================================
-- TABELA: embarcacao_comodidades
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao_comodidades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id   uuid NOT NULL REFERENCES public.embarcacao(id) ON DELETE CASCADE,
  comodidade_id   uuid NOT NULL REFERENCES public.comodidade(id) ON DELETE CASCADE,
  CONSTRAINT embarcacao_comodidades_unique UNIQUE (embarcacao_id, comodidade_id)
);

CREATE INDEX IF NOT EXISTS ec_embarcacao_idx ON public.embarcacao_comodidades (embarcacao_id);

-- RLS
ALTER TABLE public.embarcacao_comodidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.embarcacao_comodidades
  FOR ALL USING (true) WITH CHECK (true);

-- Leitura pública
CREATE POLICY "public_read" ON public.embarcacao_comodidades
  FOR SELECT USING (true);

-- Owner pode inserir e deletar comodidades das suas embarcações
CREATE POLICY "owner_write_own" ON public.embarcacao_comodidades
  FOR INSERT WITH CHECK (
    embarcacao_id IN (
      SELECT id FROM public.embarcacao WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_delete_own" ON public.embarcacao_comodidades
  FOR DELETE USING (
    embarcacao_id IN (
      SELECT id FROM public.embarcacao WHERE owner_id = auth.uid()
    )
  );
