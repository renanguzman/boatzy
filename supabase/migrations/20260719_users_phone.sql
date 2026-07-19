-- Migration: 20260719_users_phone
-- Adiciona o telefone (celular) do usuário à tabela public.users.
--
-- Armazenado em formato E.164 (ex.: +5511912345678), coletado no
-- cadastro por e-mail em /entrar. Contas via SSO (Google/Facebook/Apple)
-- não fornecem esse dado no cadastro — a coluna é NULLABLE e é
-- preenchida depois em "Minha conta".

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.users.phone IS 'Celular em formato E.164 (ex.: +5511912345678). NULL para contas SSO que ainda não preencheram.';
