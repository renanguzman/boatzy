-- ============================================================
-- PAGAMENTOS (ASAAS) — FASE 0: FILA DE EVENTOS DE WEBHOOK
--
-- Os webhooks do Asaas são entregues "at least once" (podem chegar
-- duplicados) e a fila é pausada após 15 falhas consecutivas. Por isso
-- o endpoint só faz: valida o token → grava aqui → responde 200. O
-- processamento acontece depois (after() + cron de reprocessamento).
--
-- `id` = id do evento no Asaas (ex.: 'evt_05b7…&368604920') e é a
-- chave de idempotência: o mesmo evento nunca é gravado duas vezes.
--
-- Status:
--   pendente    → gravado, aguardando processamento
--   processando → reservado por um processador (ver função abaixo)
--   processado  → handler de negócio executado com sucesso
--   ignorado    → evento sem handler (ainda) — pode ser reprocessado
--                 pelo admin quando uma fase nova passar a tratá-lo
--   erro        → handler falhou; o cron tenta de novo até o limite
--
-- Ver docs/planejamento-pagamentos-asaas.md §7.2 e SPEC §34.
-- ============================================================

CREATE TABLE public.asaas_webhook_evento (
  id               text         PRIMARY KEY,
  evento           text         NOT NULL,                  -- ex.: 'PAYMENT_RECEIVED'
  recurso_tipo     text,                                   -- chave do objeto no payload: 'payment', 'transfer'…
  recurso_id       text,                                   -- id do objeto no Asaas (pay_…, id da transferência)
  payload          jsonb        NOT NULL,                  -- corpo recebido, sem alteração
  criado_asaas_em  timestamptz,                            -- `dateCreated` do evento (horário de Brasília)
  recebido_em      timestamptz  NOT NULL DEFAULT now(),
  status           text         NOT NULL DEFAULT 'pendente',
  tentativas       integer      NOT NULL DEFAULT 0,
  erro             text,
  processado_em    timestamptz,
  atualizado_em    timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT asaas_webhook_evento_status_valido CHECK (
    status IN ('pendente', 'processando', 'processado', 'ignorado', 'erro')
  ),
  CONSTRAINT asaas_webhook_evento_tentativas_validas CHECK (tentativas >= 0)
);

CREATE INDEX asaas_webhook_evento_status_idx  ON public.asaas_webhook_evento (status, recebido_em);
CREATE INDEX asaas_webhook_evento_recurso_idx ON public.asaas_webhook_evento (recurso_id);
CREATE INDEX asaas_webhook_evento_evento_idx  ON public.asaas_webhook_evento (evento, recebido_em DESC);

-- ─────────────────────────────────────────────────────────────
-- Reserva atômica de um evento para processamento.
--
-- Evita que o after() do endpoint e o cron processem o mesmo evento ao
-- mesmo tempo: só um UPDATE consegue mudar o status para 'processando'.
-- Um evento preso em 'processando' há mais de `p_minutos_travado`
-- (processador caiu no meio) volta a ser elegível.
--
-- Retorna a linha reservada, ou nada se o evento não estava elegível.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.asaas_webhook_evento_reservar(
  p_id               text,
  p_minutos_travado  integer DEFAULT 10
)
RETURNS SETOF public.asaas_webhook_evento AS $$
  UPDATE public.asaas_webhook_evento
     SET status        = 'processando',
         tentativas    = tentativas + 1,
         atualizado_em = now()
   WHERE id = p_id
     AND (
       status IN ('pendente', 'erro')
       OR (status = 'processando' AND atualizado_em < now() - make_interval(mins => p_minutos_travado))
     )
  RETURNING *;
$$ LANGUAGE sql VOLATILE;

REVOKE ALL ON FUNCTION public.asaas_webhook_evento_reservar(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.asaas_webhook_evento_reservar(text, integer) TO service_role;

-- ============================================================
-- RLS — só o servidor (service role) lê e escreve. O painel admin
-- acessa via supabaseAdmin depois de validar a role no banco.
-- ============================================================
ALTER TABLE public.asaas_webhook_evento ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_webhook_evento TO anon, authenticated, service_role;

CREATE POLICY "service_role_all" ON public.asaas_webhook_evento
  FOR ALL TO service_role USING (true) WITH CHECK (true);
