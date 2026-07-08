-- ============================================================
-- Corrige conversas "consigo mesmo" (gestor_id = cliente_id).
--
-- Contexto: o modelo permite que uma mesma conta acumule as roles
-- `cliente` e `gestor` (ver PRD/SPEC). Antes da guarda em
-- `abrirConversa` (src/app/painel/(gestao)/clientes/actions.ts),
-- era possível criar uma conversa em que o mesmo usuário aparece
-- como gestor_id e cliente_id — o sino de notificações contava as
-- mensagens não lidas normalmente, mas o link sempre caía em 404,
-- pois `abrirConversa` recusa (corretamente) reabrir conversa
-- consigo mesmo.
--
-- Esta migração: (1) remove as conversas órfãs desse tipo,
-- (2) adiciona uma CHECK constraint para que isso nunca mais
-- aconteça, mesmo por um caminho de código diferente do atual,
-- e (3) blinda as RPCs de contagem de não lidas com o mesmo filtro,
-- como defesa em profundidade.
-- ============================================================

DELETE FROM public.conversa WHERE gestor_id = cliente_id;

ALTER TABLE public.conversa
  ADD CONSTRAINT conversa_nao_consigo_mesmo CHECK (gestor_id <> cliente_id);

CREATE OR REPLACE FUNCTION public.chat_nao_lidas_por_cliente(p_gestor uuid DEFAULT auth.uid())
RETURNS TABLE (cliente_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.cliente_id, count(m.id)
  FROM public.conversa c
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.gestor_id = p_gestor
    AND c.gestor_id <> c.cliente_id
    AND m.remetente_id = c.cliente_id
    AND m.lida_em IS NULL
  GROUP BY c.cliente_id;
$$;

CREATE OR REPLACE FUNCTION public.chat_total_nao_lidas(p_gestor uuid DEFAULT auth.uid())
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(m.id)
  FROM public.conversa c
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.gestor_id = p_gestor
    AND c.gestor_id <> c.cliente_id
    AND m.remetente_id = c.cliente_id
    AND m.lida_em IS NULL;
$$;

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
    AND c.gestor_id <> c.cliente_id
    AND m.remetente_id = c.cliente_id
    AND m.lida_em IS NULL
  GROUP BY c.id, c.cliente_id, u.name, u.avatar_url
  ORDER BY MAX(m.created_at) DESC;
$$;
