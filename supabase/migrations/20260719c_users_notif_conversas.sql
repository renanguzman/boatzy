-- Migration: 20260719c_users_notif_conversas
-- Preferência de notificação por e-mail de novas conversas (chat).
--
-- Controlada em "Minha conta" → seção "Notificações". Padrão HABILITADO
-- (true) para todos os usuários, novos e existentes.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notif_email_conversas boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.notif_email_conversas IS 'Se true, o usuário recebe e-mail (agrupado) avisando de novas mensagens de chat não lidas.';
