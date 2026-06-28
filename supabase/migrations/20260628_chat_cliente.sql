-- ============================================================
-- CHAT — RPCs do lado do CLIENTE
-- Espelham chat_nao_lidas_por_cliente / chat_total_nao_lidas
-- (20260627_chat.sql), mas na direção do cliente: contam as
-- mensagens enviadas pelo GESTOR (remetente_id = conversa.gestor_id)
-- ainda não lidas, nas conversas em que o usuário é o cliente.
--
-- security definer + param default auth.uid() para funcionar tanto
-- via service role (servidor) quanto via anon (browser → Header).
-- ============================================================

CREATE OR REPLACE FUNCTION public.chat_nao_lidas_por_gestor(p_cliente uuid DEFAULT auth.uid())
RETURNS TABLE (gestor_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.gestor_id, count(m.id)
  FROM public.conversa c
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.cliente_id = p_cliente
    AND m.remetente_id = c.gestor_id
    AND m.lida_em IS NULL
  GROUP BY c.gestor_id;
$$;

CREATE OR REPLACE FUNCTION public.chat_total_nao_lidas_cliente(p_cliente uuid DEFAULT auth.uid())
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(m.id)
  FROM public.conversa c
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.cliente_id = p_cliente
    AND m.remetente_id = c.gestor_id
    AND m.lida_em IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.chat_nao_lidas_por_gestor(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chat_total_nao_lidas_cliente(uuid) TO authenticated, service_role;
