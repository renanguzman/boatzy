-- ============================================================
-- GRANTS EXPLÍCITOS PARA A DATA API (PostgREST / supabase-js)
--
-- A partir de 30/10/2026 o Supabase deixa de conceder automaticamente
-- acesso da Data API às tabelas novas do schema public. Sem GRANT, a
-- tabela responde "permission denied", inclusive para o service role.
--
-- Em produção as tabelas existentes já têm esses grants (herdados do
-- comportamento antigo), então esta migration não muda nada lá. Ela
-- serve para que um banco recriado a partir das migrations (projeto
-- novo, preview branch, `supabase db reset`) fique acessível.
--
-- O controle de acesso continua nas policies de RLS: o GRANT só
-- libera a tabela para a Data API; quem lê/escreve cada linha é
-- decidido pelas policies.
--
-- Idempotente: GRANT só acrescenta privilégios, nunca remove.
--
-- Daqui para frente, toda migration que cria tabela em public deve
-- incluir os próprios GRANTs (ver AGENTS.md).
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

-- Colunas identity/serial: INSERT precisa de USAGE na sequence.
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;
