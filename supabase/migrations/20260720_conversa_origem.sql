-- ============================================================
-- Contexto ("origem") da conversa de chat.
--
-- A conversa é única por par gestor↔cliente (§21) e reutilizada em
-- qualquer contexto. Aqui gravamos a ÚLTIMA origem a partir da qual
-- o chat foi aberto — venda, roteiro ou embarcação — para exibir na
-- própria conversa e no e-mail de notificação.
--
--   origem_tipo  : 'venda' | 'roteiro' | 'embarcacao'
--   origem_id    : id do objeto relacionado (anúncio / roteiro / embarcação)
--   origem_label : rótulo legível (ex.: nome da embarcação/roteiro)
-- ============================================================

ALTER TABLE public.conversa
  ADD COLUMN IF NOT EXISTS origem_tipo  text,
  ADD COLUMN IF NOT EXISTS origem_id    uuid,
  ADD COLUMN IF NOT EXISTS origem_label text;

-- Recria a RPC de notificação incluindo o cliente_id (para o deep-link do
-- gestor) e a origem da conversa (para o e-mail mostrar a que se refere).
-- O DROP é obrigatório: o RETURNS TABLE mudou (novas colunas), e o Postgres
-- não permite alterar o tipo de retorno via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.chat_notificacoes_pendentes();

CREATE OR REPLACE FUNCTION public.chat_notificacoes_pendentes()
RETURNS TABLE (
  recipient_id        uuid,
  recipient_email     text,
  recipient_name      text,
  recipient_is_gestor boolean,
  conversa_id         uuid,
  cliente_id          uuid,
  origem_tipo         text,
  origem_label        text,
  remetente_nome      text,
  qtd                 bigint,
  primeira_em         timestamptz,
  ultima_em           timestamptz,
  msg_ids             uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dest.id                                   AS recipient_id,
    dest.email                                AS recipient_email,
    dest.name                                 AS recipient_name,
    (dest.id = c.gestor_id)                   AS recipient_is_gestor,
    c.id                                      AS conversa_id,
    c.cliente_id                              AS cliente_id,
    c.origem_tipo                             AS origem_tipo,
    c.origem_label                            AS origem_label,
    rem.name                                  AS remetente_nome,
    count(m.id)                               AS qtd,
    min(m.created_at)                         AS primeira_em,
    max(m.created_at)                         AS ultima_em,
    array_agg(m.id)                           AS msg_ids
  FROM public.mensagem m
  JOIN public.conversa c ON c.id = m.conversa_id
  JOIN public.users dest ON dest.id = CASE
        WHEN m.remetente_id = c.gestor_id THEN c.cliente_id
        ELSE c.gestor_id
      END
  JOIN public.users rem ON rem.id = m.remetente_id
  WHERE m.lida_em IS NULL
    AND m.notificada_em IS NULL
    AND dest.notif_email_conversas = true
    AND c.gestor_id <> c.cliente_id
  GROUP BY dest.id, dest.email, dest.name, recipient_is_gestor,
           c.id, c.cliente_id, c.origem_tipo, c.origem_label, rem.name;
$$;

REVOKE ALL ON FUNCTION public.chat_notificacoes_pendentes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_notificacoes_pendentes() TO service_role;
