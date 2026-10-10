-- Migration: 20261010_equipamentos_seguranca
-- Cria tabela de equipamentos de segurança e tabela de ligação com embarcações.

-- ============================================================
-- TABELA: equipamentos_seguranca
-- ============================================================

CREATE TABLE IF NOT EXISTS public.equipamentos_seguranca (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  text NOT NULL UNIQUE
);

-- Seeds iniciais
INSERT INTO public.equipamentos_seguranca (nome) VALUES
  ('Colete Salva-Vidas'),
  ('Boia Circular'),
  ('Sinalizador de Fumaça'),
  ('Sinalizador Luminoso'),
  ('Extintor de Incêndio'),
  ('Âncora e Corrente'),
  ('Kit de Primeiros Socorros'),
  ('Bote Salva-Vidas'),
  ('Rádio VHF'),
  ('EPIRB (Radiobaliza)'),
  ('Espelho de Sinalização'),
  ('Apito de Neblina'),
  ('Lanterna Estanque'),
  ('Cabo de Reboque'),
  ('Bomba de Porão'),
  ('Cinto de Segurança Náutico'),
  ('Mapa Náutico'),
  ('Compasso'),
  ('GPS'),
  ('Detector de Monóxido de Carbono')
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE public.equipamentos_seguranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.equipamentos_seguranca
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.equipamentos_seguranca
  FOR SELECT USING (true);

-- GRANTs obrigatórios (Supabase >= 30/10/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos_seguranca TO anon, authenticated, service_role;

-- ============================================================
-- TABELA: embarcacao_equipamentos_seguranca
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao_equipamentos_seguranca (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id             uuid NOT NULL REFERENCES public.embarcacao(id) ON DELETE CASCADE,
  equipamento_seguranca_id  uuid NOT NULL REFERENCES public.equipamentos_seguranca(id) ON DELETE CASCADE,
  CONSTRAINT embarcacao_equipamentos_seguranca_unique UNIQUE (embarcacao_id, equipamento_seguranca_id)
);

CREATE INDEX IF NOT EXISTS ees_embarcacao_idx ON public.embarcacao_equipamentos_seguranca (embarcacao_id);

-- RLS
ALTER TABLE public.embarcacao_equipamentos_seguranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.embarcacao_equipamentos_seguranca
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "public_read" ON public.embarcacao_equipamentos_seguranca
  FOR SELECT USING (true);

CREATE POLICY "owner_write_own" ON public.embarcacao_equipamentos_seguranca
  FOR INSERT WITH CHECK (
    embarcacao_id IN (
      SELECT id FROM public.embarcacao WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_delete_own" ON public.embarcacao_equipamentos_seguranca
  FOR DELETE USING (
    embarcacao_id IN (
      SELECT id FROM public.embarcacao WHERE owner_id = auth.uid()
    )
  );

-- GRANTs obrigatórios (Supabase >= 30/10/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embarcacao_equipamentos_seguranca TO anon, authenticated, service_role;
