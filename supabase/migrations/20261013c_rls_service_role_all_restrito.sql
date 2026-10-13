-- ============================================================
-- CORREÇÃO DE SEGURANÇA — policy service_role_all sem "TO".
--
-- Migrations antigas (ex.: 002_create_embarcacao_tables) criaram
-- "service_role_all ... FOR ALL USING (true) WITH CHECK (true)" sem
-- a cláusula TO service_role. Sem TO, a policy vale para PUBLIC:
-- qualquer um com a chave anon podia ler/alterar/apagar as linhas —
-- inclusive inserir o próprio papel 'admin' em user_roles.
--
-- O service role ignora RLS (BYPASSRLS), então restringir a policy a
-- ele não muda nada para o servidor (supabaseAdmin). As policies
-- específicas de cada tabela (public_read, owner_*, user_read_own…)
-- continuam valendo para anon/authenticated. Auditoria do código:
-- nenhuma consulta com a sessão do usuário dependia do acesso aberto
-- (o Header lê só os próprios papéis, coberto por user_read_own_roles).
--
-- Idempotente: ALTER POLICY só troca o papel alvo.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'user_roles', 'usuario_taxa', 'taxa_plataforma',
    'estados', 'municipios',
    'embarcacao', 'embarcacao_tipo', 'embarcacao_imagens', 'embarcacao_preco_regra',
    'comodidade', 'embarcacao_comodidades',
    'acessorios', 'embarcacao_acessorios',
    'equipamentos_seguranca', 'embarcacao_equipamentos_seguranca'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = t AND policyname = 'service_role_all') THEN
      EXECUTE format('ALTER POLICY service_role_all ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END;
$$;
