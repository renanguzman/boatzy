-- Migration: 002_create_embarcacao_tables
-- Tabelas de localização (estados e municípios) e estrutura de embarcações

-- ============================================================
-- ESTADOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.estados (
  id         integer PRIMARY KEY,
  uf         char(2) NOT NULL,
  nome       text NOT NULL,
  latitude   numeric,
  longitude  numeric,
  regiao     text
);

-- ============================================================
-- MUNICÍPIOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.municipios (
  id           integer PRIMARY KEY,
  nome         text NOT NULL,
  latitude     numeric,
  longitude    numeric,
  capital      boolean NOT NULL DEFAULT false,
  estado_id    integer NOT NULL REFERENCES public.estados(id),
  siafi_id     integer,
  ddd          integer,
  fuso_horario text
);

CREATE INDEX IF NOT EXISTS municipios_estado_id_idx ON public.municipios (estado_id);
CREATE INDEX IF NOT EXISTS municipios_nome_idx ON public.municipios (nome);

-- ============================================================
-- TABELAS AUXILIARES DE EMBARCAÇÃO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao_tipo (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.embarcacao_categoria (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

-- ============================================================
-- EMBARCAÇÃO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.embarcacao (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nome                    text NOT NULL,
  descricao               text,
  capacidade              integer,
  comprimento             numeric(6, 2),
  cabines                 integer,
  tripulacao              integer,
  embarcacao_tipo_id      uuid REFERENCES public.embarcacao_tipo(id),
  embarcacao_categoria_id uuid REFERENCES public.embarcacao_categoria(id),
  municipio_id            integer REFERENCES public.municipios(id),
  cep                     char(8),
  bairro                  text,
  logradouro              text,
  logradouro_numero       text,
  complemento             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS embarcacao_owner_id_idx         ON public.embarcacao (owner_id);
CREATE INDEX IF NOT EXISTS embarcacao_tipo_id_idx          ON public.embarcacao (embarcacao_tipo_id);
CREATE INDEX IF NOT EXISTS embarcacao_categoria_id_idx     ON public.embarcacao (embarcacao_categoria_id);
CREATE INDEX IF NOT EXISTS embarcacao_municipio_id_idx     ON public.embarcacao (municipio_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.estados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarcacao_tipo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarcacao_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarcacao         ENABLE ROW LEVEL SECURITY;

-- Leitura pública para tabelas auxiliares e de localização
CREATE POLICY "public_read" ON public.estados
  FOR SELECT USING (true);

CREATE POLICY "public_read" ON public.municipios
  FOR SELECT USING (true);

CREATE POLICY "public_read" ON public.embarcacao_tipo
  FOR SELECT USING (true);

CREATE POLICY "public_read" ON public.embarcacao_categoria
  FOR SELECT USING (true);

-- Service role tem acesso total (backend)
CREATE POLICY "service_role_all" ON public.estados
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.municipios
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.embarcacao_tipo
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.embarcacao_categoria
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.embarcacao
  FOR ALL USING (true) WITH CHECK (true);

-- Owner pode ler/editar suas próprias embarcações
CREATE POLICY "owner_read_own" ON public.embarcacao
  FOR SELECT USING (
    owner_id IN (
      SELECT id FROM public.users
      WHERE id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "owner_write_own" ON public.embarcacao
  FOR INSERT WITH CHECK (
    owner_id IN (
      SELECT id FROM public.users
      WHERE id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "owner_update_own" ON public.embarcacao
  FOR UPDATE USING (
    owner_id IN (
      SELECT id FROM public.users
      WHERE id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Embarcações são públicas para leitura (listagem no hotsite)
CREATE POLICY "public_read" ON public.embarcacao
  FOR SELECT USING (true);

-- ============================================================
-- SEED — tipos e categorias iniciais
-- ============================================================

INSERT INTO public.embarcacao_tipo (nome) VALUES
  ('Lancha'),
  ('Iate'),
  ('Jet Ski'),
  ('Veleiro'),
  ('Catamarã'),
  ('Barco de Pesca'),
  ('Escuna'),
  ('Bote')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.embarcacao_categoria (nome) VALUES
  ('Passeio'),
  ('Pesca'),
  ('Esporte'),
  ('Luxo'),
  ('Familiar')
ON CONFLICT (nome) DO NOTHING;
