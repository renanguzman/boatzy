-- ============================================================
-- Notificação por e-mail de novas conversas (agrupada).
--
-- Estratégia anti-bombardeio: NÃO se envia um e-mail por mensagem.
-- Um job (Vercel Cron → /api/cron/notificar-conversas) roda a cada
-- poucos minutos, agrupa por destinatário todas as mensagens não
-- lidas e ainda não notificadas, aplica uma "janela de sossego" e
-- dispara UM e-mail por destinatário. `notificada_em` carimba as
-- mensagens já incluídas em algum e-mail, evitando reenvio.
-- ============================================================

-- ── Marca de "já entrou num e-mail de notificação" ───────────
ALTER TABLE public.mensagem
  ADD COLUMN IF NOT EXISTS notificada_em timestamptz;

-- Índice parcial: o job só varre não lidas ainda não notificadas.
CREATE INDEX IF NOT EXISTS mensagem_pendente_notif_idx
  ON public.mensagem (conversa_id)
  WHERE lida_em IS NULL AND notificada_em IS NULL;

-- ── RPC: mensagens pendentes de notificação, agrupadas ───────
-- Retorna uma linha por (destinatário, conversa). O destinatário é
-- o participante que NÃO é o remetente. Só inclui destinatários que
-- mantêm a preferência `notif_email_conversas` habilitada. A regra
-- de janela (sossego/teto) é aplicada na aplicação (cron), que
-- conhece os parâmetros por env.
CREATE OR REPLACE FUNCTION public.chat_notificacoes_pendentes()
RETURNS TABLE (
  recipient_id       uuid,
  recipient_email    text,
  recipient_name     text,
  recipient_is_gestor boolean,
  conversa_id        uuid,
  remetente_nome     text,
  qtd                bigint,
  primeira_em        timestamptz,
  ultima_em          timestamptz,
  msg_ids            uuid[]
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
    rem.name                                  AS remetente_nome,
    count(m.id)                               AS qtd,
    min(m.created_at)                         AS primeira_em,
    max(m.created_at)                         AS ultima_em,
    array_agg(m.id)                           AS msg_ids
  FROM public.mensagem m
  JOIN public.conversa c ON c.id = m.conversa_id
  -- destinatário = o participante que não enviou a mensagem
  JOIN public.users dest ON dest.id = CASE
        WHEN m.remetente_id = c.gestor_id THEN c.cliente_id
        ELSE c.gestor_id
      END
  JOIN public.users rem ON rem.id = m.remetente_id
  WHERE m.lida_em IS NULL
    AND m.notificada_em IS NULL
    AND dest.notif_email_conversas = true
    AND c.gestor_id <> c.cliente_id
  GROUP BY dest.id, dest.email, dest.name, recipient_is_gestor, c.id, rem.name;
$$;

-- Só o backend (service role / cron) chama.
REVOKE ALL ON FUNCTION public.chat_notificacoes_pendentes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_notificacoes_pendentes() TO service_role;
