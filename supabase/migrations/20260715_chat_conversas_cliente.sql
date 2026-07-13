-- ============================================================
-- CHAT — lista de conversas do CLIENTE ("Minhas conversas").
-- Espelho de chat_conversas_nao_lidas (028, lado gestor), mas na
-- direção do cliente e listando TODAS as conversas com mensagem
-- (não só as com não lidas) — é o hub central do cliente para
-- reencontrar qualquer conversa com um gestor, inclusive as de
-- VENDA (que não têm reserva associada, então não apareciam em
-- "Minhas reservas"). Plano: docs/planejamento-vendas.md (§9).
--
-- security definer (a RLS de `users` impede o browser de ler
-- nome/avatar do gestor) + guarda anti-spoof p_cliente = auth.uid()
-- (service role: auth.uid() nulo → passa o p_cliente explícito),
-- endurecendo sobre o padrão das demais RPCs de chat.
-- ============================================================

CREATE OR REPLACE FUNCTION public.chat_conversas_cliente(p_cliente uuid DEFAULT auth.uid())
RETURNS TABLE (
  conversa_id     uuid,
  gestor_id       uuid,
  gestor_nome     text,
  gestor_avatar   text,
  ultima_mensagem text,
  ultima_em       timestamptz,
  nao_lidas       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversa_id,
    c.gestor_id,
    u.name AS gestor_nome,
    u.avatar_url AS gestor_avatar,
    (array_agg(m.conteudo ORDER BY m.created_at DESC))[1] AS ultima_mensagem,
    MAX(m.created_at) AS ultima_em,
    COUNT(*) FILTER (WHERE m.remetente_id = c.gestor_id AND m.lida_em IS NULL) AS nao_lidas
  FROM public.conversa c
  JOIN public.users u ON u.id = c.gestor_id
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.cliente_id = p_cliente
    AND c.gestor_id <> c.cliente_id
    AND (p_cliente = auth.uid() OR auth.uid() IS NULL)
  GROUP BY c.id, c.gestor_id, u.name, u.avatar_url
  ORDER BY MAX(m.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.chat_conversas_cliente(uuid)
  TO authenticated, service_role;
