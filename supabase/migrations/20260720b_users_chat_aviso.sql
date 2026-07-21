-- Migration: 20260720b_users_chat_aviso
-- Registro de ciência do aviso "converse pela plataforma" exibido ao cliente
-- na primeira vez que abre uma conversa de chat no site.
--
-- NULL = ainda não confirmou. Preenchido = timestamp em que o usuário clicou
-- em "Estou ciente" (evidência do aceite, não é apenas uma flag local).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS chat_aviso_ciente_em timestamptz;

COMMENT ON COLUMN public.users.chat_aviso_ciente_em IS 'Timestamp em que o usuário confirmou ciência do aviso de comunicação exclusiva pela plataforma (chat). NULL = ainda não confirmou.';
