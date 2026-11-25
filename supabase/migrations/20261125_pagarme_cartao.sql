-- ============================================================
-- CARTÃO DE CRÉDITO VIA STONE (PAGAR.ME v5) — Pix continua no Asaas
-- (25/11/2026) — SPEC §109, planejamento em docs/planejamento-pagamentos-stone.md
--
--   forma_pagamento.gateway        qual gateway processa a forma (pix = asaas
--                                  sempre; cartão = asaas | pagarme — chave de
--                                  rollback no admin). Nasce 'asaas' no cartão:
--                                  o admin liga a Pagar.me quando validar.
--   forma_pagamento_juros          acréscimo (%) por nº de parcelas — juros do
--                                  parcelamento 100% pagos pelo cliente (D-S5).
--                                  Só vale no cartão da Pagar.me.
--   pagamento.gateway + gateway_*  ids da Pagar.me (or_, ch_, cus_) e status cru;
--                                  `valor_juros` (valor = pedido.valor_total + juros)
--   pagamento_cartao.*             dados da adquirente (NSU, autorização, TID…)
--   pagamento_transacao.gateway_*  movimento ligado ao evento da Pagar.me
--   pagarme_webhook_evento         fila idempotente dos webhooks (espelho do Asaas)
--   ledger                         contas da Stone/Pagar.me e receita de juros;
--                                  lancar_recebimento_pagamento escolhe pelo gateway
-- ============================================================

-- ------------------------------------------------------------
-- 1. Forma de pagamento → gateway
-- ------------------------------------------------------------
ALTER TABLE public.forma_pagamento
  ADD COLUMN gateway text NOT NULL DEFAULT 'asaas',
  ADD CONSTRAINT forma_pagamento_gateway_valido CHECK (gateway IN ('asaas', 'pagarme')),
  ADD CONSTRAINT forma_pagamento_pix_asaas CHECK (codigo <> 'pix' OR gateway = 'asaas');

COMMENT ON COLUMN public.forma_pagamento.gateway IS
  'Gateway que processa a forma: pix sempre asaas; cartão asaas (legado/rollback) ou pagarme — SPEC §109.';

-- ------------------------------------------------------------
-- 2. Juros do parcelamento (pagos pelo cliente)
-- ------------------------------------------------------------
CREATE TABLE public.forma_pagamento_juros (
  parcelas              smallint      PRIMARY KEY,
  acrescimo_percentual  numeric(6,3)  NOT NULL DEFAULT 0,   -- % sobre o valor à vista
  atualizado_por        uuid          REFERENCES public.users(id) ON DELETE SET NULL,
  atualizado_em         timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT forma_pagamento_juros_parcelas_validas CHECK (parcelas BETWEEN 2 AND 12),
  CONSTRAINT forma_pagamento_juros_percentual_valido CHECK (acrescimo_percentual BETWEEN 0 AND 100)
);

CREATE TRIGGER forma_pagamento_juros_atualizado_em BEFORE UPDATE ON public.forma_pagamento_juros
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

-- Começa zerada: o admin cadastra a tabela (MDR parcelado + antecipação do contrato Stone).
INSERT INTO public.forma_pagamento_juros (parcelas)
SELECT generate_series(2, 12)
ON CONFLICT (parcelas) DO NOTHING;

ALTER TABLE public.forma_pagamento_juros ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forma_pagamento_juros TO anon, authenticated, service_role;
CREATE POLICY "service_role_all" ON public.forma_pagamento_juros FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "public_select" ON public.forma_pagamento_juros FOR SELECT TO anon, authenticated USING (true);

-- ------------------------------------------------------------
-- 3. Pagamento — gateway, ids da Pagar.me e juros
-- ------------------------------------------------------------
ALTER TABLE public.pagamento
  ADD COLUMN gateway              text           NOT NULL DEFAULT 'asaas',
  ADD COLUMN gateway_pedido_id    text,           -- or_… (Pagar.me)
  ADD COLUMN gateway_cobranca_id  text UNIQUE,    -- ch_… (Pagar.me)
  ADD COLUMN gateway_customer_id  text,           -- cus_… (Pagar.me)
  ADD COLUMN status_gateway       text,           -- status cru da cobrança/transação na Pagar.me
  ADD COLUMN valor_juros          numeric(12,2)  NOT NULL DEFAULT 0,
  ADD CONSTRAINT pagamento_gateway_valido CHECK (gateway IN ('asaas', 'pagarme')),
  ADD CONSTRAINT pagamento_ids_do_gateway CHECK (
    (gateway = 'asaas'   AND gateway_pedido_id IS NULL AND gateway_cobranca_id IS NULL)
    OR (gateway = 'pagarme' AND asaas_payment_id IS NULL AND asaas_parcelamento_id IS NULL)
  ),
  ADD CONSTRAINT pagamento_juros_valido CHECK (
    valor_juros >= 0 AND valor_juros < valor AND (valor_juros = 0 OR forma_pagamento = 'cartao_credito')
  );

CREATE INDEX pagamento_gateway_pedido_idx ON public.pagamento (gateway_pedido_id);

COMMENT ON COLUMN public.pagamento.valor_juros IS
  'Juros do parcelamento pagos pelo cliente (valor = pedido.valor_total + valor_juros) — SPEC §109.';

-- ------------------------------------------------------------
-- 4. Cartão — dados da adquirente (nunca número completo, CVV ou validade)
-- ------------------------------------------------------------
ALTER TABLE public.pagamento_cartao
  ADD COLUMN nome_portador       text,
  ADD COLUMN adquirente          text,
  ADD COLUMN adquirente_nsu      text,
  ADD COLUMN adquirente_tid      text,
  ADD COLUMN codigo_autorizacao  text,
  ADD COLUMN codigo_retorno      text,           -- ABECS
  ADD COLUMN mensagem_retorno    text;

-- ------------------------------------------------------------
-- 5. Parcela — recebível da Pagar.me
-- ------------------------------------------------------------
ALTER TABLE public.pagamento_parcela
  ADD COLUMN gateway_recebivel_id text UNIQUE;

-- ------------------------------------------------------------
-- 6. Fila de webhooks da Pagar.me (espelho de asaas_webhook_evento)
-- ------------------------------------------------------------
CREATE TABLE public.pagarme_webhook_evento (
  id                 text         PRIMARY KEY,              -- hook_… (idempotência)
  evento             text         NOT NULL,                 -- ex.: 'charge.paid'
  recurso_tipo       text,                                  -- order | charge | chargeback
  recurso_id         text,                                  -- or_… / ch_…
  payload            jsonb        NOT NULL,
  criado_gateway_em  timestamptz,                           -- `created_at` do evento
  recebido_em        timestamptz  NOT NULL DEFAULT now(),
  status             text         NOT NULL DEFAULT 'pendente',
  tentativas         integer      NOT NULL DEFAULT 0,
  erro               text,
  processado_em      timestamptz,
  atualizado_em      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pagarme_webhook_evento_status_valido CHECK (
    status IN ('pendente', 'processando', 'processado', 'ignorado', 'erro')
  )
);

CREATE INDEX pagarme_webhook_evento_status_idx  ON public.pagarme_webhook_evento (status, recebido_em);
CREATE INDEX pagarme_webhook_evento_recurso_idx ON public.pagarme_webhook_evento (recurso_id);
CREATE INDEX pagarme_webhook_evento_evento_idx  ON public.pagarme_webhook_evento (evento, recebido_em DESC);

-- Reserva atômica (o after() do endpoint e o cron nunca processam o mesmo evento juntos).
CREATE OR REPLACE FUNCTION public.pagarme_webhook_evento_reservar(
  p_id               text,
  p_minutos_travado  integer DEFAULT 10
)
RETURNS SETOF public.pagarme_webhook_evento AS $$
  UPDATE public.pagarme_webhook_evento
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

REVOKE ALL ON FUNCTION public.pagarme_webhook_evento_reservar(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pagarme_webhook_evento_reservar(text, integer) TO service_role;

ALTER TABLE public.pagarme_webhook_evento ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagarme_webhook_evento TO anon, authenticated, service_role;
CREATE POLICY "service_role_all" ON public.pagarme_webhook_evento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 7. Movimentos — evento da Pagar.me
-- ------------------------------------------------------------
ALTER TABLE public.pagamento_transacao
  ADD COLUMN gateway            text  NOT NULL DEFAULT 'asaas',
  ADD COLUMN status_gateway     text,
  ADD COLUMN gateway_evento_id  text  UNIQUE REFERENCES public.pagarme_webhook_evento(id) ON DELETE SET NULL,
  ADD CONSTRAINT pagamento_transacao_gateway_valido CHECK (gateway IN ('asaas', 'pagarme'));

-- ------------------------------------------------------------
-- 8. Estorno — origem Pagar.me
-- ------------------------------------------------------------
ALTER TABLE public.pagamento_estorno DROP CONSTRAINT pagamento_estorno_origem_valida;
ALTER TABLE public.pagamento_estorno ADD CONSTRAINT pagamento_estorno_origem_valida
  CHECK (origem IN ('cliente', 'gestor', 'admin', 'chargeback', 'asaas', 'pagarme'));

-- ------------------------------------------------------------
-- 9. Ledger — contas da Stone/Pagar.me e receita de juros (validar com o contador)
-- ------------------------------------------------------------
INSERT INTO public.conta_contabil (codigo, nome, grupo) VALUES
  ('1.1.03', 'Saldo Stone/Pagar.me (cartão)',        'ativo'),
  ('3.1.03', 'Tarifas de cartão Stone/Pagar.me (MDR)', 'despesa'),
  ('4.1.02', 'Receita de juros de parcelamento',      'receita')
ON CONFLICT (codigo) DO NOTHING;

-- Recebimento: igual ao de 20261104_repasses.sql, com caixa/tarifa pelo gateway e os juros.
--    D caixa (1.1.01 Asaas | 1.1.03 Stone) líquido · D tarifa (3.1.01 | 3.1.03) · D 3.1.02 desconto
--    C 2.1.01 valor_itens · C 4.1.01 comissão · C 4.1.02 juros
--    Σ D = valor + desconto = itens + comissão + juros = Σ C
CREATE OR REPLACE FUNCTION public.lancar_recebimento_pagamento(p_pagamento uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET timezone = 'America/Sao_Paulo'
SET search_path = public
AS $$
DECLARE
  p        public.pagamento%ROWTYPE;
  pe       public.pedido%ROWTYPE;
  v_ref    text := 'pagamento:' || p_pagamento || ':recebimento';
  v_fim    date;
  v_caixa  date;
  v_lote   uuid;
  v_conta_caixa  text;
  v_conta_tarifa text;
  v_linhas jsonb;
BEGIN
  SELECT * INTO p FROM pagamento WHERE id = p_pagamento;
  IF NOT FOUND OR p.status <> 'recebido' OR p.valor_liquido IS NULL THEN RETURN NULL; END IF;
  IF p.numero_parcelas > 1 AND (
       SELECT count(*) FROM pagamento_parcela pp WHERE pp.pagamento_id = p.id AND pp.status = 'recebido'
     ) < p.numero_parcelas THEN
    RETURN NULL;
  END IF;

  SELECT * INTO pe FROM pedido WHERE id = p.pedido_id;
  IF NOT FOUND OR pe.status NOT IN ('pago', 'reembolsado_parcial', 'em_disputa', 'reembolsado') THEN RETURN NULL; END IF;

  SELECT id INTO v_lote FROM lancamento_lote WHERE origem_ref = v_ref;
  IF FOUND THEN RETURN v_lote; END IF;

  IF EXISTS (SELECT 1 FROM lancamento_lote WHERE pedido_id = pe.id AND tipo = 'recebimento') THEN
    RAISE EXCEPTION 'pedido_ja_lancado: o pedido % já tem recebimento lançado por outro pagamento', pe.numero;
  END IF;

  IF p.gateway = 'pagarme' THEN
    v_conta_caixa := '1.1.03'; v_conta_tarifa := '3.1.03';
  ELSE
    v_conta_caixa := '1.1.01'; v_conta_tarifa := '3.1.01';
  END IF;

  v_caixa := (COALESCE(p.recebido_em, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
  SELECT COALESCE(r.data_fim_reserva, r.data_reserva) INTO v_fim
    FROM reserva r
    LEFT JOIN pedido_avulso pa ON pa.pedido_id = pe.id
   WHERE r.id = COALESCE(pe.reserva_id, pa.reserva_id);

  v_linhas := jsonb_build_array(
    jsonb_build_object('conta', v_conta_caixa,  'natureza', 'D', 'valor', p.valor_liquido),
    jsonb_build_object('conta', v_conta_tarifa, 'natureza', 'D', 'valor', p.valor - p.valor_liquido),
    jsonb_build_object('conta', '3.1.02',       'natureza', 'D', 'valor', pe.valor_desconto),
    jsonb_build_object('conta', '2.1.01',       'natureza', 'C', 'valor', pe.valor_itens),
    jsonb_build_object('conta', '4.1.01',       'natureza', 'C', 'valor', pe.valor_comissao)
  );
  IF p.valor_juros > 0 THEN
    v_linhas := v_linhas || jsonb_build_array(jsonb_build_object('conta', '4.1.02', 'natureza', 'C', 'valor', p.valor_juros));
  END IF;

  RETURN registrar_lancamentos(
    v_ref, 'recebimento', 'Pagamento recebido — pedido #' || pe.numero,
    pe.id, p.id, NULL, pe.gestor_id, COALESCE(v_fim, v_caixa), v_caixa, NULL, NULL,
    v_linhas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lancar_recebimento_pagamento(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lancar_recebimento_pagamento(uuid) TO service_role;
