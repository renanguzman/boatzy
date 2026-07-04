-- ============================================================
-- RPC para o sino de notificações do painel (gestor).
-- Lista as conversas com mensagens NÃO LIDAS enviadas pelo
-- cliente, com nome/avatar, contagem, preview e data da última
-- mensagem — em uma chamada só (o browser não pode ler `users`
-- de terceiros via RLS, por isso security definer, mesmo padrão
-- das RPCs de chat existentes: chat_nao_lidas_por_cliente etc.).
-- Futuramente o sino agregará outros tipos de notificação.
-- ============================================================

CREATE OR REPLACE FUNCTION public.chat_conversas_nao_lidas(p_gestor uuid DEFAULT auth.uid())
RETURNS TABLE (
  conversa_id     uuid,
  cliente_id      uuid,
  cliente_nome    text,
  cliente_avatar  text,
  total           bigint,
  ultima_mensagem text,
  ultima_em       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversa_id,
    c.cliente_id,
    u.name AS cliente_nome,
    u.avatar_url AS cliente_avatar,
    COUNT(m.id) AS total,
    (array_agg(m.conteudo ORDER BY m.created_at DESC))[1] AS ultima_mensagem,
    MAX(m.created_at) AS ultima_em
  FROM public.conversa c
  JOIN public.users u ON u.id = c.cliente_id
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.gestor_id = p_gestor
    AND m.remetente_id = c.cliente_id
    AND m.lida_em IS NULL
  GROUP BY c.id, c.cliente_id, u.name, u.avatar_url
  ORDER BY MAX(m.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.chat_conversas_nao_lidas(uuid)
  TO authenticated, service_role;
