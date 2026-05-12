-- Migration: 001_create_users_and_roles
-- Tabela de usuários do Boatzy sincronizada com o Clerk
-- Tabela de roles para suportar múltiplas roles por usuário

-- Enum de roles
CREATE TYPE user_role AS ENUM ('admin', 'gestor', 'cliente');

-- Tabela users (dados do usuário)
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_clerk    text NOT NULL UNIQUE,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  cpf_cnpj    text,
  birthday    date,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS users_id_clerk_idx ON public.users (id_clerk);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- RLS: habilitar row level security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: service role tem acesso total (usado pelo backend)
CREATE POLICY "service_role_all" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

-- Policy: usuário autenticado pode ler seu próprio registro
CREATE POLICY "user_read_own" ON public.users
  FOR SELECT USING (
    id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Tabela user_roles (multi-role por usuário)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Indexes
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);

-- RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.user_roles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "user_read_own_roles" ON public.user_roles
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users
      WHERE id_clerk = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );
