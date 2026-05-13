-- Migration: 004_taxas_plataforma
-- Taxa geral da plataforma e taxa específica por usuário.
-- A taxa efetiva de um usuário é: usuario_taxa (se existir, ativo e dentro da validade) OU taxa_plataforma.

-- ============================================================
-- TAXA GERAL DA PLATAFORMA (singleton)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.taxa_plataforma (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxa_percent numeric(5, 2) NOT NULL
                 CHECK (taxa_percent >= 0 AND taxa_percent <= 100),
  descricao    text,
  -- Garante que existe somente um registro ativo
  singleton    boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton = true),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS taxa_plataforma_singleton_idx ON public.taxa_plataforma (singleton);

-- ============================================================
-- TAXA ESPECÍFICA POR USUÁRIO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usuario_taxa (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  taxa_percent numeric(5, 2) NOT NULL
                 CHECK (taxa_percent >= 0 AND taxa_percent <= 100),
  ativo          boolean NOT NULL DEFAULT true,
  -- NULL = sem validade (vigente indefinidamente); preenchido = expira ao final do dia informado
  data_validade  date,
  observacao     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Um registro por usuário
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS usuario_taxa_user_id_idx ON public.usuario_taxa (user_id);
CREATE INDEX IF NOT EXISTS usuario_taxa_ativo_idx   ON public.usuario_taxa (ativo);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.taxa_plataforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_taxa    ENABLE ROW LEVEL SECURITY;

-- Service role: acesso total (backend / admin)
CREATE POLICY "service_role_all" ON public.taxa_plataforma
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.usuario_taxa
  FOR ALL USING (true) WITH CHECK (true);

-- Leitura pública da taxa geral (necessária para exibição no hotsite/checkout)
CREATE POLICY "public_read" ON public.taxa_plataforma
  FOR SELECT USING (true);

-- Usuário autenticado pode ler sua própria taxa específica
CREATE POLICY "user_read_own" ON public.usuario_taxa
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users
      WHERE id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- ============================================================
-- FUNÇÃO: taxa efetiva de um usuário
-- Retorna usuario_taxa.taxa_percent se existir, ativo e dentro da validade
-- (data_validade IS NULL  ou  data_validade >= CURRENT_DATE),
-- caso contrário retorna taxa_plataforma.taxa_percent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_taxa_usuario(p_user_id uuid)
RETURNS numeric(5, 2)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT ut.taxa_percent
      FROM   public.usuario_taxa ut
      WHERE  ut.user_id      = p_user_id
        AND  ut.ativo        = true
        AND  (ut.data_validade IS NULL OR ut.data_validade >= CURRENT_DATE)
      LIMIT  1
    ),
    (
      SELECT tp.taxa_percent
      FROM   public.taxa_plataforma tp
      WHERE  tp.singleton = true
      LIMIT  1
    )
  );
$$;

-- ============================================================
-- SEED — taxa geral padrão (10%)
-- ============================================================

INSERT INTO public.taxa_plataforma (taxa_percent, descricao)
VALUES (10.00, 'Taxa padrão da plataforma Boatzy')
ON CONFLICT (singleton) DO NOTHING;
