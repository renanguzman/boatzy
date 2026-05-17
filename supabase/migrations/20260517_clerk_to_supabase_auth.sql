-- ============================================================
-- Migration: Clerk → Supabase Auth
-- Data: 2026-05-17
--
-- Execute no SQL Editor do Supabase Dashboard.
-- ============================================================


-- ─── 1. Dropar todas as policies que dependem de id_clerk ─────
-- (necessário antes de poder remover a coluna)

DROP POLICY IF EXISTS user_read_own           ON public.users;
DROP POLICY IF EXISTS user_read_own_roles     ON public.user_roles;
DROP POLICY IF EXISTS owner_read_own          ON public.embarcacao;
DROP POLICY IF EXISTS owner_write_own         ON public.embarcacao;
DROP POLICY IF EXISTS owner_update_own        ON public.embarcacao;
DROP POLICY IF EXISTS owner_write_own         ON public.embarcacao_imagens;
DROP POLICY IF EXISTS owner_update_own        ON public.embarcacao_imagens;
DROP POLICY IF EXISTS owner_delete_own        ON public.embarcacao_imagens;
DROP POLICY IF EXISTS user_read_own           ON public.usuario_taxa;
DROP POLICY IF EXISTS owner_read_own          ON public.embarcacao_preco_regra;
DROP POLICY IF EXISTS owner_write_own         ON public.embarcacao_preco_regra;
DROP POLICY IF EXISTS owner_update_own        ON public.embarcacao_preco_regra;
DROP POLICY IF EXISTS owner_delete_own        ON public.embarcacao_preco_regra;


-- ─── 2. Remover coluna id_clerk ───────────────────────────────
ALTER TABLE public.users
  DROP COLUMN IF EXISTS id_clerk;


-- ─── 3. Limpar dados incompatíveis com o novo sistema ────────
-- Os IDs antigos em public.users eram UUIDs aleatórios do Supabase,
-- não existem em auth.users (os usuários reais viviam no Clerk).
-- Precisamos limpar antes de adicionar a FK.
--
-- Para preservar os dados de embarcações, dropamos temporariamente
-- todas as FKs de outras tabelas que apontam para public.users,
-- truncamos users + user_roles, depois restauramos as FKs.

-- 3a. Dropar FKs que apontam para public.users (exceto user_roles,
--     que já está no TRUNCATE abaixo)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT kcu.table_name, kcu.constraint_name
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = rc.constraint_name
     AND kcu.table_schema    = 'public'
    JOIN information_schema.table_constraints tc
      ON tc.constraint_name  = rc.unique_constraint_name
     AND tc.table_schema     = 'public'
     AND tc.table_name       = 'users'
    WHERE kcu.table_name <> 'user_roles'
    GROUP BY kcu.table_name, kcu.constraint_name
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      r.table_name, r.constraint_name
    );
    RAISE NOTICE 'Dropped FK % on %', r.constraint_name, r.table_name;
  END LOOP;
END $$;

-- 3b. Truncar tabelas de usuário (dados incompatíveis com Supabase Auth)
TRUNCATE public.user_roles, public.users;

-- ─── 4. FK de users.id → auth.users(id) ─────────────────────
-- users.id agora é o mesmo UUID que auth.users.id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_id_fkey'
      AND table_name       = 'users'
      AND table_schema     = 'public'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ─── 4. Habilitar RLS ─────────────────────────────────────────
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarcacao          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarcacao_imagens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embarcacao_preco_regra ENABLE ROW LEVEL SECURITY;


-- ─── 5. Recriar policies — users ──────────────────────────────
-- Usuário só lê/edita o próprio registro.
-- Backend usa service role (bypassa RLS automaticamente).

DROP POLICY IF EXISTS user_read_own    ON public.users;
DROP POLICY IF EXISTS user_update_own  ON public.users;

CREATE POLICY user_read_own ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY user_update_own ON public.users
  FOR UPDATE USING (auth.uid() = id);


-- ─── 6. Recriar policies — user_roles ─────────────────────────
DROP POLICY IF EXISTS user_read_own_roles ON public.user_roles;

CREATE POLICY user_read_own_roles ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());


-- ─── 7. Recriar policies — embarcacao ─────────────────────────
-- Público pode listar embarcações (hotsite).
-- Dono pode criar, editar e ver as suas.

DROP POLICY IF EXISTS public_read      ON public.embarcacao;
DROP POLICY IF EXISTS owner_write_own  ON public.embarcacao;
DROP POLICY IF EXISTS owner_update_own ON public.embarcacao;
DROP POLICY IF EXISTS owner_delete_own ON public.embarcacao;

CREATE POLICY public_read ON public.embarcacao
  FOR SELECT USING (true);

CREATE POLICY owner_write_own ON public.embarcacao
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY owner_update_own ON public.embarcacao
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY owner_delete_own ON public.embarcacao
  FOR DELETE USING (owner_id = auth.uid());


-- ─── 8. Recriar policies — embarcacao_imagens ─────────────────
DROP POLICY IF EXISTS public_read      ON public.embarcacao_imagens;
DROP POLICY IF EXISTS owner_write_own  ON public.embarcacao_imagens;
DROP POLICY IF EXISTS owner_update_own ON public.embarcacao_imagens;
DROP POLICY IF EXISTS owner_delete_own ON public.embarcacao_imagens;

CREATE POLICY public_read ON public.embarcacao_imagens
  FOR SELECT USING (true);

CREATE POLICY owner_write_own ON public.embarcacao_imagens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY owner_update_own ON public.embarcacao_imagens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY owner_delete_own ON public.embarcacao_imagens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.owner_id = auth.uid()
    )
  );


-- ─── 9. Recriar policies — embarcacao_preco_regra ─────────────
DROP POLICY IF EXISTS public_read      ON public.embarcacao_preco_regra;
DROP POLICY IF EXISTS owner_write_own  ON public.embarcacao_preco_regra;
DROP POLICY IF EXISTS owner_update_own ON public.embarcacao_preco_regra;
DROP POLICY IF EXISTS owner_delete_own ON public.embarcacao_preco_regra;

CREATE POLICY public_read ON public.embarcacao_preco_regra
  FOR SELECT USING (true);

CREATE POLICY owner_write_own ON public.embarcacao_preco_regra
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY owner_update_own ON public.embarcacao_preco_regra
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY owner_delete_own ON public.embarcacao_preco_regra
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.owner_id = auth.uid()
    )
  );


-- ─── 10. Recriar policy — usuario_taxa ────────────────────────
-- Só existe se a tabela usuario_taxa existir no seu projeto.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usuario_taxa'
  ) THEN
    EXECUTE '
      ALTER TABLE public.usuario_taxa ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS user_read_own ON public.usuario_taxa;

      CREATE POLICY user_read_own ON public.usuario_taxa
        FOR SELECT USING (user_id = auth.uid());
    ';
  END IF;
END $$;


-- ─── 11. (Opcional) Custom Access Token Hook ──────────────────
-- Para incluir roles no JWT do Supabase, crie esta função e
-- configure em: Authentication > Hooks > Custom Access Token Hook
--
-- CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
-- RETURNS jsonb LANGUAGE plpgsql AS $$
-- DECLARE
--   claims        jsonb;
--   user_roles_arr text[];
-- BEGIN
--   SELECT array_agg(role::text) INTO user_roles_arr
--   FROM public.user_roles
--   WHERE user_id = (event->>'user_id')::uuid;
--
--   claims := event->'claims';
--   claims := jsonb_set(
--     claims,
--     '{user_roles}',
--     coalesce(to_jsonb(user_roles_arr), '[]'::jsonb)
--   );
--   RETURN jsonb_set(event, '{claims}', claims);
-- END;
-- $$;
--
-- GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
-- REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
