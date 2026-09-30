-- ============================================================
-- PAGAMENTOS (ASAAS) — FASE 1.1: MODELO DE DADOS + CONFIGURAÇÃO
--
-- Objetivo: guardar no Boatzy tudo o que é preciso para conciliação,
-- sem depender do painel do Asaas. Hierarquia:
--
--   reserva (já existe — a reserva do roteiro/embarcação)
--     └─ pedido                  1 por reserva: o que o cliente compra e quanto paga
--          ├─ pedido_desconto    descontos aplicados (cupom → FK para `cupom`, que já existe)
--          └─ pagamento          cada tentativa de pagamento = 1 cobrança no Asaas
--               ├─ pagamento_cartao     bandeira + 4 últimos dígitos (nunca o número completo)
--               ├─ pagamento_parcela    parcelas do cartão (quando parcelado)
--               ├─ pagamento_transacao  histórico de movimentos vindos do gateway
--               └─ pagamento_estorno    estornos (total/parcial)
--
--   forma_pagamento     catálogo (pix, cartao_credito) + parcelamento global
--   cliente_asaas       usuário interno ↔ customer do Asaas, por ambiente
--   financeiro_config   parâmetros (prazo para pagar, horas para repasse…)
--   financeiro_auditoria  trilha append-only das ações do admin
--
-- A comissão NÃO é configurada aqui: continua vindo do módulo Taxas
-- (`taxa_plataforma` + `usuario_taxa`, via `get_taxa_usuario`) e é
-- congelada na reserva no momento da solicitação (`reserva.taxa_percent`).
--
-- FKs para `reserva`/`users` são RESTRICT: registro financeiro não some
-- por exclusão em cascata (retenção fiscal).
--
-- Ver docs/planejamento-pagamentos-asaas.md §6.1 e SPEC §34.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Trigger genérico de atualizado_em
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.financeiro_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- forma_pagamento — catálogo + configuração global de parcelamento
-- ============================================================
CREATE TABLE public.forma_pagamento (
  codigo                text          PRIMARY KEY,               -- 'pix' | 'cartao_credito'
  nome                  text          NOT NULL,
  codigo_asaas          text          NOT NULL UNIQUE,           -- billingType: 'PIX' | 'CREDIT_CARD'
  ativo                 boolean       NOT NULL DEFAULT true,
  ordem                 smallint      NOT NULL DEFAULT 0,
  parcelas_max          smallint      NOT NULL DEFAULT 1,        -- 1 = só à vista
  valor_minimo_parcela  numeric(12,2),                           -- NULL = sem mínimo
  criado_em             timestamptz   NOT NULL DEFAULT now(),
  atualizado_em         timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT forma_pagamento_codigo_formato CHECK (codigo ~ '^[a-z_]+$'),
  CONSTRAINT forma_pagamento_parcelas_validas CHECK (parcelas_max BETWEEN 1 AND 12),
  CONSTRAINT forma_pagamento_parcela_so_cartao CHECK (codigo = 'cartao_credito' OR parcelas_max = 1),
  CONSTRAINT forma_pagamento_minimo_valido CHECK (valor_minimo_parcela IS NULL OR valor_minimo_parcela > 0)
);

CREATE TRIGGER forma_pagamento_atualizado_em BEFORE UPDATE ON public.forma_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

INSERT INTO public.forma_pagamento (codigo, nome, codigo_asaas, ordem, parcelas_max) VALUES
  ('pix',            'Pix',               'PIX',         1, 1),
  ('cartao_credito', 'Cartão de crédito', 'CREDIT_CARD', 2, 1);   -- começa só à vista

-- ============================================================
-- cliente_asaas — customer do Asaas por usuário e ambiente
-- (o customer do sandbox não existe em produção)
-- ============================================================
CREATE TABLE public.cliente_asaas (
  user_id            uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ambiente           text         NOT NULL,
  asaas_customer_id  text         NOT NULL UNIQUE,              -- cus_…
  criado_em          timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ambiente),
  CONSTRAINT cliente_asaas_ambiente_valido CHECK (ambiente IN ('sandbox', 'producao'))
);

-- ============================================================
-- pedido — 1 por reserva que exige pagamento
-- ============================================================
CREATE TABLE public.pedido (
  id                   uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  numero               bigint         GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,  -- nº amigável (#1001)
  reserva_id           uuid           NOT NULL UNIQUE REFERENCES public.reserva(id) ON DELETE RESTRICT,
  cliente_id           uuid           NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  gestor_id            uuid           NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- Valores (snapshot no momento em que o pedido é gerado)
  valor_itens          numeric(12,2)  NOT NULL,                  -- preço + adicionais → vai para o gestor
  comissao_percentual  numeric(5,2)   NOT NULL,                  -- reserva.taxa_percent (taxa da solicitação)
  valor_comissao       numeric(12,2)  NOT NULL,                  -- taxa de serviço (paga pelo cliente)
  valor_desconto       numeric(12,2)  NOT NULL DEFAULT 0,        -- soma de pedido_desconto
  valor_total          numeric(12,2)  NOT NULL,                  -- o que o cliente paga

  status               text           NOT NULL DEFAULT 'aguardando_pagamento',
  expira_em            timestamptz,                              -- prazo para pagar
  pago_em              timestamptz,
  cancelado_em         timestamptz,
  motivo_cancelamento  text,
  criado_em            timestamptz    NOT NULL DEFAULT now(),
  atualizado_em        timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pedido_status_valido CHECK (status IN (
    'aguardando_pagamento', 'pago', 'expirado', 'cancelado', 'reembolsado', 'reembolsado_parcial', 'em_disputa'
  )),
  CONSTRAINT pedido_valores_nao_negativos CHECK (
    valor_itens >= 0 AND valor_comissao >= 0 AND valor_desconto >= 0 AND valor_total >= 0
  ),
  CONSTRAINT pedido_comissao_percentual_valida CHECK (comissao_percentual BETWEEN 0 AND 100),
  CONSTRAINT pedido_total_coerente CHECK (
    valor_total = GREATEST(0, valor_itens + valor_comissao - valor_desconto)
  )
);

CREATE INDEX pedido_cliente_idx ON public.pedido (cliente_id, criado_em DESC);
CREATE INDEX pedido_gestor_idx  ON public.pedido (gestor_id, criado_em DESC);
CREATE INDEX pedido_status_idx  ON public.pedido (status, expira_em);

CREATE TRIGGER pedido_atualizado_em BEFORE UPDATE ON public.pedido
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

-- ============================================================
-- pedido_desconto — descontos do pedido (cupom usa a tabela `cupom` existente;
-- o uso do cupom continua registrado em `cupom_uso`)
-- ============================================================
CREATE TABLE public.pedido_desconto (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id     uuid           NOT NULL REFERENCES public.pedido(id) ON DELETE CASCADE,
  tipo          text           NOT NULL,                         -- 'cupom' | 'manual' | 'promocional'
  cupom_id      uuid           REFERENCES public.cupom(id) ON DELETE SET NULL,
  cupom_codigo  text,                                            -- snapshot
  descricao     text,
  percentual    numeric(5,2),                                    -- quando o desconto é percentual
  valor         numeric(12,2)  NOT NULL,                         -- valor abatido em R$
  criado_por    uuid           REFERENCES public.users(id) ON DELETE SET NULL,  -- admin, no desconto manual
  criado_em     timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pedido_desconto_tipo_valido CHECK (tipo IN ('cupom', 'manual', 'promocional')),
  CONSTRAINT pedido_desconto_cupom_coerente CHECK (tipo <> 'cupom' OR cupom_codigo IS NOT NULL),
  CONSTRAINT pedido_desconto_valor_positivo CHECK (valor > 0),
  CONSTRAINT pedido_desconto_percentual_valido CHECK (percentual IS NULL OR percentual BETWEEN 0 AND 100)
);

CREATE INDEX pedido_desconto_pedido_idx ON public.pedido_desconto (pedido_id);
CREATE INDEX pedido_desconto_cupom_idx  ON public.pedido_desconto (cupom_id);

-- ============================================================
-- pagamento — cada tentativa de pagamento do pedido = 1 cobrança no Asaas.
-- O `id` vai como externalReference na cobrança (idempotência: em timeout,
-- consultar o Asaas por ele antes de tentar de novo).
-- ============================================================
CREATE TABLE public.pagamento (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id              uuid           NOT NULL REFERENCES public.pedido(id) ON DELETE RESTRICT,
  forma_pagamento        text           NOT NULL REFERENCES public.forma_pagamento(codigo),
  ambiente               text           NOT NULL,
  numero_parcelas        smallint       NOT NULL DEFAULT 1,

  -- Asaas
  asaas_payment_id       text           UNIQUE,                  -- pay_… (NULL até a cobrança ser criada)
  asaas_parcelamento_id  text,                                   -- installment (quando parcelado)
  asaas_customer_id      text,                                   -- cus_… (snapshot)
  status_asaas           text,                                   -- valor cru (PENDING, CONFIRMED, RECEIVED…)

  -- Valores
  valor                  numeric(12,2)  NOT NULL,                -- total cobrado
  valor_liquido          numeric(12,2),                          -- netValue (soma das parcelas, se parcelado)
  valor_tarifa           numeric(12,2)  GENERATED ALWAYS AS (valor - valor_liquido) STORED,  -- absorvida pelo Boatzy

  status                 text           NOT NULL DEFAULT 'pendente',
  vencimento             date,
  fatura_url             text,                                   -- invoiceUrl
  numero_fatura          text,                                   -- invoiceNumber
  comprovante_url        text,                                   -- transactionReceiptUrl

  -- Pix
  pix_qrcode_payload     text,                                   -- copia-e-cola
  pix_qrcode_expira_em   timestamptz,
  pix_transacao_id       text,                                   -- pixTransaction

  -- Datas do ciclo
  confirmado_em          timestamptz,
  recebido_em            timestamptz,
  credito_previsto_em    date,                                   -- estimatedCreditDate (cartão ~D+32)

  ultimo_payload         jsonb,                                  -- último objeto "payment" do Asaas
  criado_em              timestamptz    NOT NULL DEFAULT now(),
  atualizado_em          timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pagamento_ambiente_valido CHECK (ambiente IN ('sandbox', 'producao')),
  CONSTRAINT pagamento_status_valido CHECK (status IN (
    'pendente', 'em_analise', 'confirmado', 'recebido', 'recusado', 'vencido', 'cancelado',
    'estorno_em_andamento', 'estornado', 'estornado_parcial', 'em_disputa'
  )),
  CONSTRAINT pagamento_valor_positivo CHECK (valor > 0),
  CONSTRAINT pagamento_parcelas_validas CHECK (numero_parcelas BETWEEN 1 AND 12),
  CONSTRAINT pagamento_parcela_so_cartao CHECK (forma_pagamento = 'cartao_credito' OR numero_parcelas = 1)
);

CREATE INDEX pagamento_pedido_idx       ON public.pagamento (pedido_id, criado_em DESC);
CREATE INDEX pagamento_status_idx       ON public.pagamento (status, criado_em DESC);
CREATE INDEX pagamento_parcelamento_idx ON public.pagamento (asaas_parcelamento_id);

CREATE TRIGGER pagamento_atualizado_em BEFORE UPDATE ON public.pagamento
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

-- ============================================================
-- pagamento_cartao — só bandeira e 4 últimos dígitos.
-- O cartão é digitado na fatura do Asaas: o número completo, o CVV e a
-- validade NUNCA passam pelo Boatzy. O Asaas devolve `creditCard` com
-- `creditCardBrand` e `creditCardNumber` (apenas os 4 últimos dígitos).
-- ============================================================
CREATE TABLE public.pagamento_cartao (
  pagamento_id     uuid         PRIMARY KEY REFERENCES public.pagamento(id) ON DELETE CASCADE,
  bandeira         text         NOT NULL,                        -- VISA, MASTERCARD, ELO, AMEX… | UNKNOWN
  ultimos_digitos  char(4)      NOT NULL,
  criado_em        timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT pagamento_cartao_bandeira_formato CHECK (bandeira ~ '^[A-Z_]{2,30}$'),
  CONSTRAINT pagamento_cartao_ultimos_digitos CHECK (ultimos_digitos ~ '^[0-9]{4}$')
);

-- ============================================================
-- pagamento_parcela — parcelas do cartão (só quando numero_parcelas > 1).
-- No Asaas cada parcela é uma cobrança própria, creditada num mês diferente.
-- ============================================================
CREATE TABLE public.pagamento_parcela (
  id                   uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id         uuid           NOT NULL REFERENCES public.pagamento(id) ON DELETE CASCADE,
  numero               smallint       NOT NULL,
  total                smallint       NOT NULL,
  valor                numeric(12,2)  NOT NULL,
  valor_liquido        numeric(12,2),
  asaas_payment_id     text           UNIQUE,                    -- pay_… da parcela
  status               text           NOT NULL DEFAULT 'pendente',
  status_asaas         text,
  vencimento           date,
  credito_previsto_em  date,
  recebido_em          timestamptz,
  criado_em            timestamptz    NOT NULL DEFAULT now(),
  atualizado_em        timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pagamento_parcela_numero_valido CHECK (numero BETWEEN 1 AND total AND total BETWEEN 2 AND 12),
  CONSTRAINT pagamento_parcela_valor_positivo CHECK (valor > 0),
  CONSTRAINT pagamento_parcela_status_valido CHECK (status IN (
    'pendente', 'confirmado', 'recebido', 'cancelado', 'estornado', 'em_disputa'
  )),
  UNIQUE (pagamento_id, numero)
);

CREATE TRIGGER pagamento_parcela_atualizado_em BEFORE UPDATE ON public.pagamento_parcela
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

-- ============================================================
-- pagamento_transacao — histórico de movimentos do pagamento vindos do
-- gateway (criação, confirmação, recebimento, estorno, chargeback…), com
-- valor e data. Trilha de conciliação por pagamento; o payload bruto de
-- cada webhook continua em asaas_webhook_evento.
-- ============================================================
CREATE TABLE public.pagamento_transacao (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id     uuid           NOT NULL REFERENCES public.pagamento(id) ON DELETE CASCADE,
  parcela_id       uuid           REFERENCES public.pagamento_parcela(id) ON DELETE CASCADE,
  tipo             text           NOT NULL,   -- criacao, confirmacao, recebimento, vencimento, cancelamento,
                                              -- recusa, estorno, estorno_parcial, chargeback, …
  status_asaas     text,
  valor            numeric(12,2),
  ocorrido_em      timestamptz    NOT NULL DEFAULT now(),
  asaas_evento_id  text           UNIQUE REFERENCES public.asaas_webhook_evento(id) ON DELETE SET NULL,
  payload          jsonb,
  criado_em        timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pagamento_transacao_tipo_formato CHECK (tipo ~ '^[a-z_]+$')
);

CREATE INDEX pagamento_transacao_pagamento_idx ON public.pagamento_transacao (pagamento_id, ocorrido_em);

-- ============================================================
-- pagamento_estorno — estornos totais/parciais (fluxos na Fase 2; já
-- registrável por webhook quando o estorno é feito pelo painel do Asaas)
-- ============================================================
CREATE TABLE public.pagamento_estorno (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id     uuid           NOT NULL REFERENCES public.pagamento(id) ON DELETE RESTRICT,
  parcela_id       uuid           REFERENCES public.pagamento_parcela(id) ON DELETE RESTRICT,
  valor            numeric(12,2)  NOT NULL,
  motivo           text           NOT NULL,
  origem           text           NOT NULL,   -- cliente | gestor | admin | chargeback | asaas
  status           text           NOT NULL DEFAULT 'solicitado',
  solicitado_por   uuid           REFERENCES public.users(id) ON DELETE SET NULL,
  comprovante_url  text,
  payload          jsonb,                     -- item de refunds[] do Asaas
  solicitado_em    timestamptz    NOT NULL DEFAULT now(),
  concluido_em     timestamptz,
  atualizado_em    timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pagamento_estorno_valor_positivo CHECK (valor > 0),
  CONSTRAINT pagamento_estorno_origem_valida CHECK (origem IN ('cliente', 'gestor', 'admin', 'chargeback', 'asaas')),
  CONSTRAINT pagamento_estorno_status_valido CHECK (status IN ('solicitado', 'em_andamento', 'concluido', 'cancelado'))
);

CREATE INDEX pagamento_estorno_pagamento_idx ON public.pagamento_estorno (pagamento_id);

CREATE TRIGGER pagamento_estorno_atualizado_em BEFORE UPDATE ON public.pagamento_estorno
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

-- ============================================================
-- financeiro_config — parâmetros (singleton, mesmo padrão de taxa_plataforma)
-- ============================================================
CREATE TABLE public.financeiro_config (
  id                          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton                   boolean      NOT NULL DEFAULT true UNIQUE CHECK (singleton = true),
  horas_prazo_pagamento       integer      NOT NULL DEFAULT 24,   -- após o aceite do gestor
  horas_repasse_apos_passeio  integer      NOT NULL DEFAULT 48,   -- após o fim do passeio, com realização confirmada pelo gestor
  repasse_automatico          boolean      NOT NULL DEFAULT false, -- chave geral (Fase 3)
  atualizado_por              uuid         REFERENCES public.users(id) ON DELETE SET NULL,
  atualizado_em               timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT financeiro_config_prazo_valido CHECK (horas_prazo_pagamento BETWEEN 1 AND 168),
  CONSTRAINT financeiro_config_repasse_valido CHECK (horas_repasse_apos_passeio BETWEEN 0 AND 720)
);

CREATE TRIGGER financeiro_config_atualizado_em BEFORE UPDATE ON public.financeiro_config
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

INSERT INTO public.financeiro_config (singleton) VALUES (true);

-- ============================================================
-- financeiro_auditoria — toda ação manual do admin no financeiro (append-only)
-- ============================================================
CREATE TABLE public.financeiro_auditoria (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid         REFERENCES public.users(id) ON DELETE SET NULL,
  acao         text         NOT NULL,                             -- ex.: 'forma_pagamento.atualizar'
  entidade     text         NOT NULL,                             -- ex.: 'forma_pagamento'
  entidade_id  text,
  antes        jsonb,
  depois       jsonb,
  motivo       text,
  criado_em    timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT financeiro_auditoria_acao_formato CHECK (acao ~ '^[a-z_.]+$')
);

CREATE INDEX financeiro_auditoria_entidade_idx ON public.financeiro_auditoria (entidade, entidade_id, criado_em DESC);
CREATE INDEX financeiro_auditoria_data_idx     ON public.financeiro_auditoria (criado_em DESC);

CREATE OR REPLACE FUNCTION public.financeiro_auditoria_imutavel()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'financeiro_auditoria é append-only (% recusado)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER financeiro_auditoria_sem_update BEFORE UPDATE OR DELETE ON public.financeiro_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditoria_imutavel();
CREATE TRIGGER financeiro_auditoria_sem_truncate BEFORE TRUNCATE ON public.financeiro_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION public.financeiro_auditoria_imutavel();

-- ============================================================
-- RLS + GRANTs (AGENTS.md). Escritas só pelo servidor (service role).
-- Leitura direta pelo usuário só onde faz sentido; o painel/admin lê via
-- supabaseAdmin depois de validar a sessão/role.
-- ============================================================
ALTER TABLE public.forma_pagamento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_asaas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_desconto      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_cartao     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_parcela    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_transacao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento_estorno    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.forma_pagamento, public.cliente_asaas, public.pedido, public.pedido_desconto,
  public.pagamento, public.pagamento_cartao, public.pagamento_parcela, public.pagamento_transacao,
  public.pagamento_estorno, public.financeiro_config, public.financeiro_auditoria
  TO anon, authenticated, service_role;

-- Coluna identity: INSERT precisa de USAGE na sequence.
GRANT USAGE, SELECT ON SEQUENCE public.pedido_numero_seq TO anon, authenticated, service_role;

CREATE POLICY "service_role_all" ON public.forma_pagamento      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.cliente_asaas        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pedido               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pedido_desconto      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pagamento            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pagamento_cartao     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pagamento_parcela    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pagamento_transacao  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pagamento_estorno    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.financeiro_config    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.financeiro_auditoria FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Catálogo público (a página de pagamento mostra as formas ativas).
CREATE POLICY "public_select" ON public.forma_pagamento FOR SELECT TO anon, authenticated USING (true);

-- Cliente e gestor enxergam os próprios pedidos (tela do cliente / painel do gestor).
CREATE POLICY "participante_select" ON public.pedido FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR gestor_id = auth.uid());

CREATE POLICY "participante_select" ON public.pedido_desconto FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido p WHERE p.id = pedido_id
                 AND (p.cliente_id = auth.uid() OR p.gestor_id = auth.uid())));

CREATE POLICY "participante_select" ON public.pagamento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido p WHERE p.id = pedido_id
                 AND (p.cliente_id = auth.uid() OR p.gestor_id = auth.uid())));

CREATE POLICY "participante_select" ON public.pagamento_parcela FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pagamento pg JOIN public.pedido p ON p.id = pg.pedido_id
                 WHERE pg.id = pagamento_id AND (p.cliente_id = auth.uid() OR p.gestor_id = auth.uid())));

-- Dados do cartão: só o próprio cliente (o gestor não precisa).
CREATE POLICY "cliente_select" ON public.pagamento_cartao FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pagamento pg JOIN public.pedido p ON p.id = pg.pedido_id
                 WHERE pg.id = pagamento_id AND p.cliente_id = auth.uid()));
