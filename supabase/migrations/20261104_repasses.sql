-- ============================================================
-- REPASSES AO GESTOR + LEDGER CONTÁBIL + DADOS DE RECEBIMENTO
--
-- O Boatzy recebe 100% do valor no Asaas (sem split) e repassa ao gestor o
-- valor dos itens (`pedido.valor_itens`) depois do passeio. O admin paga fora
-- (Pix/TED) e REGISTRA aqui; tudo vira partida dobrada para balancete e
-- exportação ao contador. SPEC §101.
--
--   gestor_recebimento    onde o gestor recebe (Pix ou conta); troca = nova linha
--   repasse               lote: 1 pagamento ao gestor (meio, data, quem, comprovante)
--   repasse_item          pedidos cobertos pelo lote
--   conta_contabil        plano de contas (seed — validar com o contador)
--   lancamento_lote       cabeçalho do lançamento contábil (append-only)
--   lancamento_financeiro partidas D/C do lote (append-only, lote sempre balanceado)
--   pedido_repasse_situacao (view) única regra de elegibilidade (admin e painel)
--
-- Funções (só service_role): lancar_recebimento_pagamento, registrar_repasse,
-- cancelar_repasse, registrar_lancamentos, balancete, demonstrativo_gestores,
-- salvar_gestor_recebimento.
--
-- Elegibilidade: pagamento liquidado (`recebido` — no parcelado, todas as
-- parcelas) + fim do passeio (coalesce(data_fim_reserva, data_reserva), até
-- 23:59 de Brasília) + financeiro_config.horas_repasse_apos_passeio.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Dados de recebimento do gestor
-- ------------------------------------------------------------
CREATE TABLE public.gestor_recebimento (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo               text         NOT NULL,                 -- 'pix' | 'conta'

  pix_tipo_chave     text,                                  -- cpf | cnpj | email | telefone | aleatoria
  pix_chave          text,

  banco_codigo       text,                                  -- COMPE (3 dígitos)
  banco_nome         text,
  agencia            text,
  conta              text,
  conta_digito       text,
  tipo_conta         text,                                  -- corrente | poupanca

  titular_nome       text         NOT NULL,
  titular_documento  text         NOT NULL,                 -- só dígitos (CPF/CNPJ)

  ativo              boolean      NOT NULL DEFAULT true,
  criado_em          timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT gestor_recebimento_tipo_valido CHECK (tipo IN ('pix', 'conta')),
  CONSTRAINT gestor_recebimento_pix_coerente CHECK (
    tipo <> 'pix' OR (
      pix_tipo_chave IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')
      AND NULLIF(btrim(pix_chave), '') IS NOT NULL
    )
  ),
  CONSTRAINT gestor_recebimento_conta_coerente CHECK (
    tipo <> 'conta' OR (
      NULLIF(btrim(banco_codigo), '') IS NOT NULL
      AND NULLIF(btrim(agencia), '') IS NOT NULL
      AND NULLIF(btrim(conta), '') IS NOT NULL
      AND tipo_conta IN ('corrente', 'poupanca')
    )
  ),
  CONSTRAINT gestor_recebimento_titular_valido CHECK (
    char_length(btrim(titular_nome)) >= 2 AND titular_documento ~ '^[0-9]{11}$|^[0-9]{14}$'
  )
);

-- Um destino ativo por gestor; as trocas ficam como histórico (ativo = false).
CREATE UNIQUE INDEX gestor_recebimento_ativo_uidx ON public.gestor_recebimento (owner_id) WHERE ativo;
CREATE INDEX gestor_recebimento_owner_idx ON public.gestor_recebimento (owner_id, criado_em DESC);

ALTER TABLE public.gestor_recebimento ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestor_recebimento TO anon, authenticated, service_role;
CREATE POLICY "service_role_all" ON public.gestor_recebimento FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "gestor_select_proprio" ON public.gestor_recebimento FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- ------------------------------------------------------------
-- 2. Repasse (lote) e itens
-- ------------------------------------------------------------
CREATE TABLE public.repasse (
  id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            bigint         GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  gestor_id         uuid           NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  valor_total       numeric(12,2)  NOT NULL,
  status            text           NOT NULL DEFAULT 'pago',
  metodo            text           NOT NULL,
  pago_em           timestamptz    NOT NULL,                -- quando o dinheiro saiu
  pago_por          uuid           REFERENCES public.users(id) ON DELETE SET NULL,  -- admin que registrou
  referencia        text,                                   -- E2E do Pix / id da transação
  observacao        text,
  destino_snapshot  jsonb          NOT NULL,                -- destino + dados do gestor no momento do pagamento
  comprovante_key   text,                                   -- R2 (bucket privado)
  comprovante_nome  text,
  cancelado_em      timestamptz,
  cancelado_por     uuid           REFERENCES public.users(id) ON DELETE SET NULL,
  motivo_cancelamento text,
  criado_em         timestamptz    NOT NULL DEFAULT now(),
  atualizado_em     timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT repasse_status_valido CHECK (status IN ('pago', 'cancelado')),
  CONSTRAINT repasse_metodo_valido CHECK (metodo IN ('pix', 'ted', 'doc', 'outro')),
  CONSTRAINT repasse_valor_positivo CHECK (valor_total > 0),
  CONSTRAINT repasse_cancelamento_coerente CHECK (
    (status = 'cancelado') = (cancelado_em IS NOT NULL)
  )
);

CREATE INDEX repasse_gestor_idx ON public.repasse (gestor_id, pago_em DESC);
CREATE INDEX repasse_pago_em_idx ON public.repasse (pago_em DESC);

CREATE TRIGGER repasse_atualizado_em BEFORE UPDATE ON public.repasse
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_atualizado_em();

CREATE TABLE public.repasse_item (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  repasse_id  uuid           NOT NULL REFERENCES public.repasse(id) ON DELETE RESTRICT,
  pedido_id   uuid           NOT NULL REFERENCES public.pedido(id) ON DELETE RESTRICT,
  valor       numeric(12,2)  NOT NULL,                      -- snapshot de pedido.valor_itens
  cancelado   boolean        NOT NULL DEFAULT false,
  criado_em   timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT repasse_item_valor_positivo CHECK (valor > 0)
);

-- Um pedido só entra em um repasse vigente (o cancelamento do lote libera o pedido).
CREATE UNIQUE INDEX repasse_item_pedido_vigente_uidx ON public.repasse_item (pedido_id) WHERE NOT cancelado;
CREATE INDEX repasse_item_repasse_idx ON public.repasse_item (repasse_id);

ALTER TABLE public.repasse      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repasse_item ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repasse, public.repasse_item TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.repasse_numero_seq TO anon, authenticated, service_role;
CREATE POLICY "service_role_all" ON public.repasse      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.repasse_item FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "gestor_select_proprio" ON public.repasse FOR SELECT TO authenticated
  USING (gestor_id = auth.uid());
CREATE POLICY "gestor_select_proprio" ON public.repasse_item FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.repasse r WHERE r.id = repasse_id AND r.gestor_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. Plano de contas e lançamentos (partidas dobradas, append-only)
-- ------------------------------------------------------------
CREATE TABLE public.conta_contabil (
  codigo                text  PRIMARY KEY,
  nome                  text  NOT NULL,
  grupo                 text  NOT NULL,
  codigo_contabilidade  text,                               -- código no plano do escritório (mapeamento)
  CONSTRAINT conta_contabil_grupo_valido CHECK (grupo IN ('ativo', 'passivo', 'receita', 'despesa'))
);

INSERT INTO public.conta_contabil (codigo, nome, grupo) VALUES
  ('1.1.01', 'Saldo na conta Asaas',            'ativo'),
  ('1.1.02', 'Banco (repasses a gestores)',     'ativo'),
  ('2.1.01', 'Obrigações com gestores',         'passivo'),
  ('3.1.01', 'Tarifas do Asaas',                'despesa'),
  ('3.1.02', 'Descontos e cupons concedidos',   'despesa'),
  ('4.1.01', 'Receita de comissão (taxa de serviço)', 'receita')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE public.lancamento_lote (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_ref       text         NOT NULL UNIQUE,            -- idempotência ('pagamento:<id>:recebimento', 'repasse:<id>')
  tipo             text         NOT NULL,
  descricao        text,
  pedido_id        uuid         REFERENCES public.pedido(id) ON DELETE RESTRICT,
  pagamento_id     uuid         REFERENCES public.pagamento(id) ON DELETE RESTRICT,
  repasse_id       uuid         REFERENCES public.repasse(id) ON DELETE RESTRICT,
  gestor_id        uuid         REFERENCES public.users(id) ON DELETE RESTRICT,
  data_competencia date         NOT NULL,
  data_caixa       date         NOT NULL,
  estorno_de       uuid         REFERENCES public.lancamento_lote(id) ON DELETE RESTRICT,
  criado_por       uuid         REFERENCES public.users(id) ON DELETE SET NULL,
  criado_em        timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT lancamento_lote_tipo_valido CHECK (tipo IN ('recebimento', 'repasse', 'estorno', 'ajuste'))
);

CREATE INDEX lancamento_lote_competencia_idx ON public.lancamento_lote (data_competencia);
CREATE INDEX lancamento_lote_caixa_idx       ON public.lancamento_lote (data_caixa);
CREATE INDEX lancamento_lote_pedido_idx      ON public.lancamento_lote (pedido_id);
CREATE INDEX lancamento_lote_gestor_idx      ON public.lancamento_lote (gestor_id, data_caixa);
CREATE INDEX lancamento_lote_repasse_idx     ON public.lancamento_lote (repasse_id);

CREATE TABLE public.lancamento_financeiro (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id       uuid           NOT NULL REFERENCES public.lancamento_lote(id) ON DELETE RESTRICT,
  conta_codigo  text           NOT NULL REFERENCES public.conta_contabil(codigo),
  natureza      text           NOT NULL,
  valor         numeric(12,2)  NOT NULL,

  CONSTRAINT lancamento_financeiro_natureza_valida CHECK (natureza IN ('D', 'C')),
  CONSTRAINT lancamento_financeiro_valor_positivo CHECK (valor > 0)
);

CREATE INDEX lancamento_financeiro_lote_idx  ON public.lancamento_financeiro (lote_id);
CREATE INDEX lancamento_financeiro_conta_idx ON public.lancamento_financeiro (conta_codigo);

-- Append-only: correção se faz com lote inverso (estorno), nunca editando.
CREATE OR REPLACE FUNCTION public.lancamento_imutavel()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% é append-only (% recusado)', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lancamento_lote_sem_update BEFORE UPDATE OR DELETE ON public.lancamento_lote
  FOR EACH ROW EXECUTE FUNCTION public.lancamento_imutavel();
CREATE TRIGGER lancamento_lote_sem_truncate BEFORE TRUNCATE ON public.lancamento_lote
  FOR EACH STATEMENT EXECUTE FUNCTION public.lancamento_imutavel();
CREATE TRIGGER lancamento_financeiro_sem_update BEFORE UPDATE OR DELETE ON public.lancamento_financeiro
  FOR EACH ROW EXECUTE FUNCTION public.lancamento_imutavel();
CREATE TRIGGER lancamento_financeiro_sem_truncate BEFORE TRUNCATE ON public.lancamento_financeiro
  FOR EACH STATEMENT EXECUTE FUNCTION public.lancamento_imutavel();

-- Todo lote fecha em zero (Σ débitos = Σ créditos), conferido no commit.
CREATE OR REPLACE FUNCTION public.lancamento_lote_balanceado()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COALESCE(SUM(CASE WHEN natureza = 'D' THEN valor ELSE -valor END), 0)
        FROM public.lancamento_financeiro WHERE lote_id = NEW.lote_id) <> 0 THEN
    RAISE EXCEPTION 'lancamento_desbalanceado: lote % não fecha (débitos <> créditos)', NEW.lote_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER lancamento_financeiro_balanceado
  AFTER INSERT ON public.lancamento_financeiro
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.lancamento_lote_balanceado();

ALTER TABLE public.conta_contabil         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamento_lote        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamento_financeiro  ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.conta_contabil, public.lancamento_lote, public.lancamento_financeiro
  TO anon, authenticated, service_role;
CREATE POLICY "service_role_all" ON public.conta_contabil        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.lancamento_lote       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.lancamento_financeiro FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 4. Lançamento genérico (idempotente por origem_ref)
--    p_linhas: [{"conta":"1.1.01","natureza":"D","valor":123.45}, …] (valor 0 é ignorado)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_lancamentos(
  p_origem_ref       text,
  p_tipo             text,
  p_descricao        text,
  p_pedido_id        uuid,
  p_pagamento_id     uuid,
  p_repasse_id       uuid,
  p_gestor_id        uuid,
  p_data_competencia date,
  p_data_caixa       date,
  p_criado_por       uuid,
  p_estorno_de       uuid,
  p_linhas           jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote  uuid;
  v_linha jsonb;
  v_valor numeric(12,2);
  v_deb   numeric(12,2) := 0;
  v_cred  numeric(12,2) := 0;
BEGIN
  SELECT id INTO v_lote FROM lancamento_lote WHERE origem_ref = p_origem_ref;
  IF FOUND THEN RETURN v_lote; END IF;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    v_valor := round((v_linha ->> 'valor')::numeric, 2);
    IF v_valor > 0 THEN
      IF v_linha ->> 'natureza' = 'D' THEN v_deb := v_deb + v_valor; ELSE v_cred := v_cred + v_valor; END IF;
    END IF;
  END LOOP;
  IF v_deb = 0 OR v_deb <> v_cred THEN
    RAISE EXCEPTION 'lancamento_desbalanceado: débitos % <> créditos %', v_deb, v_cred;
  END IF;

  INSERT INTO lancamento_lote
    (origem_ref, tipo, descricao, pedido_id, pagamento_id, repasse_id, gestor_id,
     data_competencia, data_caixa, estorno_de, criado_por)
  VALUES
    (p_origem_ref, p_tipo, p_descricao, p_pedido_id, p_pagamento_id, p_repasse_id, p_gestor_id,
     p_data_competencia, p_data_caixa, p_estorno_de, p_criado_por)
  RETURNING id INTO v_lote;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    v_valor := round((v_linha ->> 'valor')::numeric, 2);
    IF v_valor > 0 THEN
      INSERT INTO lancamento_financeiro (lote_id, conta_codigo, natureza, valor)
      VALUES (v_lote, v_linha ->> 'conta', v_linha ->> 'natureza', v_valor);
    END IF;
  END LOOP;

  RETURN v_lote;
END;
$$;

-- ------------------------------------------------------------
-- 5. Pagamento liquidado no Asaas → obrigação com o gestor, comissão, tarifa
--    D 1.1.01 líquido · D 3.1.01 tarifa · D 3.1.02 desconto
--    C 2.1.01 valor_itens · C 4.1.01 comissão          (Σ D = bruto + desconto = Σ C)
--    Devolve NULL quando ainda não é hora (não recebido, parcelas em aberto, sem
--    valor líquido, pedido encerrado); o webhook chama a cada evento.
-- ------------------------------------------------------------
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

  v_caixa := (COALESCE(p.recebido_em, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
  SELECT COALESCE(r.data_fim_reserva, r.data_reserva) INTO v_fim
    FROM reserva r
    LEFT JOIN pedido_avulso pa ON pa.pedido_id = pe.id
   WHERE r.id = COALESCE(pe.reserva_id, pa.reserva_id);

  RETURN registrar_lancamentos(
    v_ref, 'recebimento', 'Pagamento recebido — pedido #' || pe.numero,
    pe.id, p.id, NULL, pe.gestor_id, COALESCE(v_fim, v_caixa), v_caixa, NULL, NULL,
    jsonb_build_array(
      jsonb_build_object('conta', '1.1.01', 'natureza', 'D', 'valor', p.valor_liquido),
      jsonb_build_object('conta', '3.1.01', 'natureza', 'D', 'valor', p.valor - p.valor_liquido),
      jsonb_build_object('conta', '3.1.02', 'natureza', 'D', 'valor', pe.valor_desconto),
      jsonb_build_object('conta', '2.1.01', 'natureza', 'C', 'valor', pe.valor_itens),
      jsonb_build_object('conta', '4.1.01', 'natureza', 'C', 'valor', pe.valor_comissao)
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- 6. View: situação de repasse de cada pedido pago (fonte única da regra)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.pedido_repasse_situacao
WITH (security_invoker = on) AS
WITH cfg AS (
  SELECT horas_repasse_apos_passeio AS horas FROM public.financeiro_config LIMIT 1
),
pag AS (
  SELECT DISTINCT ON (p.pedido_id)
    p.pedido_id,
    p.id               AS pagamento_id,
    p.status           AS pagamento_status,
    p.forma_pagamento,
    p.recebido_em,
    p.credito_previsto_em,
    p.valor            AS pagamento_valor,
    p.valor_liquido,
    p.valor_tarifa,
    (p.status = 'recebido' AND (
       p.numero_parcelas = 1
       OR (SELECT count(*) FROM public.pagamento_parcela pp
            WHERE pp.pagamento_id = p.id AND pp.status = 'recebido') >= p.numero_parcelas
    )) AS liquidado
  FROM public.pagamento p
  WHERE p.status IN ('confirmado', 'recebido', 'estornado_parcial', 'estornado', 'em_disputa')
  ORDER BY p.pedido_id, (p.status = 'recebido') DESC, p.criado_em DESC
),
base AS (
  SELECT
    pe.id AS pedido_id, pe.numero, pe.tipo, pe.gestor_id, pe.cliente_id,
    pe.status AS pedido_status, pe.pago_em,
    pe.valor_itens, pe.valor_comissao, pe.valor_desconto, pe.valor_total,
    r.id AS reserva_id, r.status AS reserva_status, r.data_reserva,
    COALESCE(r.data_fim_reserva, r.data_reserva) AS fim_passeio,
    pag.pagamento_id, pag.pagamento_status, pag.forma_pagamento, pag.recebido_em, pag.credito_previsto_em,
    pag.pagamento_valor, pag.valor_liquido, pag.valor_tarifa, pag.liquidado,
    ri.repasse_id, rep.numero AS repasse_numero, rep.pago_em AS repasse_pago_em,
    cfg.horas
  FROM public.pedido pe
  JOIN pag ON pag.pedido_id = pe.id
  CROSS JOIN cfg
  LEFT JOIN public.pedido_avulso pa ON pa.pedido_id = pe.id
  LEFT JOIN public.reserva r ON r.id = COALESCE(pe.reserva_id, pa.reserva_id)
  LEFT JOIN public.repasse_item ri ON ri.pedido_id = pe.id AND NOT ri.cancelado
  LEFT JOIN public.repasse rep ON rep.id = ri.repasse_id
  WHERE pe.status IN ('pago', 'reembolsado_parcial', 'em_disputa', 'reembolsado')
)
SELECT
  b.pedido_id, b.numero, b.tipo, b.gestor_id, b.cliente_id, b.pedido_status, b.pago_em,
  b.valor_itens, b.valor_comissao, b.valor_desconto, b.valor_total,
  b.reserva_id, b.reserva_status, b.data_reserva, b.fim_passeio,
  b.pagamento_id, b.pagamento_status, b.forma_pagamento, b.recebido_em, b.credito_previsto_em,
  b.pagamento_valor, b.valor_liquido, b.valor_tarifa, b.liquidado,
  b.repasse_id, b.repasse_numero, b.repasse_pago_em,
  b.valor_itens AS valor_repassar,
  -- 00:00 do dia seguinte ao fim do passeio (Brasília) + prazo configurado
  CASE WHEN b.fim_passeio IS NULL THEN NULL
       ELSE ((b.fim_passeio + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') + make_interval(hours => b.horas)
  END AS liberado_em,
  CASE
    WHEN b.repasse_id IS NOT NULL                                            THEN 'repassado'
    WHEN b.pedido_status = 'reembolsado'                                     THEN 'reembolsado'
    WHEN b.pedido_status <> 'pago'
      OR b.reserva_status IN ('cancelada', 'recusada', 'expirada')           THEN 'retido'
    WHEN NOT b.liquidado                                                     THEN 'aguardando_recebimento'
    WHEN b.fim_passeio IS NULL
      OR now() < ((b.fim_passeio + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') THEN 'aguardando_passeio'
    WHEN now() < ((b.fim_passeio + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') + make_interval(hours => b.horas)
                                                                             THEN 'aguardando_prazo'
    ELSE 'a_repassar'
  END AS situacao
FROM base b;

REVOKE ALL ON public.pedido_repasse_situacao FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pedido_repasse_situacao TO service_role;

-- ------------------------------------------------------------
-- 7. Registrar o repasse (lote) — atômico: repasse + itens + lançamento
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_repasse(
  p_repasse_id       uuid,
  p_gestor           uuid,
  p_pedidos          uuid[],
  p_metodo           text,
  p_pago_em          timestamptz,
  p_referencia       text,
  p_observacao       text,
  p_admin            uuid,
  p_comprovante_key  text,
  p_comprovante_nome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET timezone = 'America/Sao_Paulo'
SET search_path = public
AS $$
DECLARE
  v_ids      uuid[];
  v_rec      public.gestor_recebimento%ROWTYPE;
  v_gestor   public.users%ROWTYPE;
  v_total    numeric(12,2);
  v_liberados integer;
  v_numero   bigint;
  v_dia      date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin AND role = 'admin') THEN
    RAISE EXCEPTION 'apenas_admin';
  END IF;
  IF p_metodo NOT IN ('pix', 'ted', 'doc', 'outro') THEN RAISE EXCEPTION 'metodo_invalido'; END IF;
  IF p_pago_em > now() + interval '5 minutes' THEN RAISE EXCEPTION 'data_futura'; END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(p_pedidos) AS x;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN RAISE EXCEPTION 'sem_pedidos'; END IF;

  SELECT * INTO v_rec FROM gestor_recebimento WHERE owner_id = p_gestor AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'gestor_sem_recebimento'; END IF;
  SELECT * INTO v_gestor FROM users WHERE id = p_gestor;

  -- Trava os pedidos e confere que todos estão liberados para este gestor.
  PERFORM 1 FROM pedido WHERE id = ANY (v_ids) FOR UPDATE;
  SELECT count(*), COALESCE(sum(valor_repassar), 0) INTO v_liberados, v_total
    FROM pedido_repasse_situacao
   WHERE pedido_id = ANY (v_ids) AND gestor_id = p_gestor AND situacao = 'a_repassar';
  IF v_liberados <> cardinality(v_ids) THEN RAISE EXCEPTION 'pedido_nao_liberado'; END IF;

  INSERT INTO repasse
    (id, gestor_id, valor_total, metodo, pago_em, pago_por, referencia, observacao,
     destino_snapshot, comprovante_key, comprovante_nome)
  VALUES
    (p_repasse_id, p_gestor, v_total, p_metodo, p_pago_em, p_admin,
     NULLIF(btrim(p_referencia), ''), NULLIF(btrim(p_observacao), ''),
     jsonb_build_object(
       'gestor_nome', v_gestor.name, 'gestor_documento', v_gestor.cpf_cnpj,
       'recebimento_id', v_rec.id, 'tipo', v_rec.tipo,
       'pix_tipo_chave', v_rec.pix_tipo_chave, 'pix_chave', v_rec.pix_chave,
       'banco_codigo', v_rec.banco_codigo, 'banco_nome', v_rec.banco_nome,
       'agencia', v_rec.agencia, 'conta', v_rec.conta, 'conta_digito', v_rec.conta_digito,
       'tipo_conta', v_rec.tipo_conta,
       'titular_nome', v_rec.titular_nome, 'titular_documento', v_rec.titular_documento
     ),
     NULLIF(btrim(p_comprovante_key), ''), NULLIF(btrim(p_comprovante_nome), ''))
  RETURNING numero INTO v_numero;

  INSERT INTO repasse_item (repasse_id, pedido_id, valor)
  SELECT p_repasse_id, s.pedido_id, s.valor_repassar
    FROM pedido_repasse_situacao s
   WHERE s.pedido_id = ANY (v_ids);

  v_dia := (p_pago_em AT TIME ZONE 'America/Sao_Paulo')::date;
  PERFORM registrar_lancamentos(
    'repasse:' || p_repasse_id, 'repasse', 'Repasse #' || v_numero || ' — ' || v_gestor.name,
    NULL, NULL, p_repasse_id, p_gestor, v_dia, v_dia, p_admin, NULL,
    jsonb_build_array(
      jsonb_build_object('conta', '2.1.01', 'natureza', 'D', 'valor', v_total),
      jsonb_build_object('conta', '1.1.02', 'natureza', 'C', 'valor', v_total)
    )
  );

  RETURN jsonb_build_object('id', p_repasse_id, 'numero', v_numero, 'valor_total', v_total, 'pedidos', cardinality(v_ids));
END;
$$;

-- ------------------------------------------------------------
-- 8. Cancelar o repasse — libera os pedidos e lança o inverso
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_repasse(p_repasse uuid, p_admin uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET timezone = 'America/Sao_Paulo'
SET search_path = public
AS $$
DECLARE
  v        public.repasse%ROWTYPE;
  v_orig   uuid;
  v_dia    date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin AND role = 'admin') THEN
    RAISE EXCEPTION 'apenas_admin';
  END IF;
  IF char_length(btrim(COALESCE(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'motivo_obrigatorio'; END IF;

  SELECT * INTO v FROM repasse WHERE id = p_repasse FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'repasse_inexistente'; END IF;
  IF v.status <> 'pago' THEN RAISE EXCEPTION 'repasse_ja_cancelado'; END IF;

  UPDATE repasse
     SET status = 'cancelado', cancelado_em = now(), cancelado_por = p_admin, motivo_cancelamento = btrim(p_motivo)
   WHERE id = p_repasse;
  UPDATE repasse_item SET cancelado = true WHERE repasse_id = p_repasse;

  SELECT id INTO v_orig FROM lancamento_lote WHERE origem_ref = 'repasse:' || p_repasse;
  PERFORM registrar_lancamentos(
    'repasse:' || p_repasse || ':cancelamento', 'estorno', 'Cancelamento do repasse #' || v.numero,
    NULL, NULL, p_repasse, v.gestor_id, v_dia, v_dia, p_admin, v_orig,
    jsonb_build_array(
      jsonb_build_object('conta', '1.1.02', 'natureza', 'D', 'valor', v.valor_total),
      jsonb_build_object('conta', '2.1.01', 'natureza', 'C', 'valor', v.valor_total)
    )
  );

  RETURN jsonb_build_object('id', p_repasse, 'numero', v.numero);
END;
$$;

-- ------------------------------------------------------------
-- 9. Balancete por período (base: competência ou caixa)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.balancete(p_de date, p_ate date, p_base text DEFAULT 'competencia')
RETURNS TABLE (
  conta_codigo text, conta_nome text, grupo text, codigo_contabilidade text,
  debitos numeric, creditos numeric, saldo numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT t.codigo, t.nome, t.grupo, t.codigo_contabilidade, t.d, t.c,
         CASE WHEN t.grupo IN ('ativo', 'despesa') THEN t.d - t.c ELSE t.c - t.d END
    FROM (
      SELECT c.codigo, c.nome, c.grupo, c.codigo_contabilidade,
             COALESCE(sum(l.valor) FILTER (WHERE l.natureza = 'D'), 0) AS d,
             COALESCE(sum(l.valor) FILTER (WHERE l.natureza = 'C'), 0) AS c
        FROM conta_contabil c
        LEFT JOIN (
          lancamento_financeiro l
          JOIN lancamento_lote lt ON lt.id = l.lote_id
           AND (CASE WHEN p_base = 'caixa' THEN lt.data_caixa ELSE lt.data_competencia END) BETWEEN p_de AND p_ate
        ) ON l.conta_codigo = c.codigo
       GROUP BY c.codigo, c.nome, c.grupo, c.codigo_contabilidade
    ) t
   ORDER BY t.codigo;
$$;

-- ------------------------------------------------------------
-- 9b. Gestor informa/troca onde recebe — atômico: desativa o destino atual
--     (fica no histórico) e grava o novo. Retorna {id, anterior_id}.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salvar_gestor_recebimento(p_owner uuid, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antigo uuid;
  v_novo   uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_owner AND role IN ('gestor', 'admin')) THEN
    RAISE EXCEPTION 'apenas_gestor';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gestor_recebimento:' || p_owner, 0));

  UPDATE gestor_recebimento SET ativo = false WHERE owner_id = p_owner AND ativo
  RETURNING id INTO v_antigo;

  INSERT INTO gestor_recebimento
    (owner_id, tipo, pix_tipo_chave, pix_chave, banco_codigo, banco_nome, agencia, conta, conta_digito,
     tipo_conta, titular_nome, titular_documento)
  VALUES
    (p_owner, p_dados ->> 'tipo',
     NULLIF(btrim(p_dados ->> 'pix_tipo_chave'), ''), NULLIF(btrim(p_dados ->> 'pix_chave'), ''),
     NULLIF(btrim(p_dados ->> 'banco_codigo'), ''), NULLIF(btrim(p_dados ->> 'banco_nome'), ''),
     NULLIF(btrim(p_dados ->> 'agencia'), ''), NULLIF(btrim(p_dados ->> 'conta'), ''),
     NULLIF(btrim(p_dados ->> 'conta_digito'), ''), NULLIF(btrim(p_dados ->> 'tipo_conta'), ''),
     btrim(p_dados ->> 'titular_nome'), p_dados ->> 'titular_documento')
  RETURNING id INTO v_novo;

  RETURN jsonb_build_object('id', v_novo, 'anterior_id', v_antigo);
END;
$$;

-- ------------------------------------------------------------
-- 9c. Demonstrativo por gestor no período (base: competência ou caixa)
--     bruto = o que o cliente pagou (líquido + tarifa) · devido = valor dos itens (obrigação)
--     repassado = repasses pagos − repasses cancelados (lotes com repasse_id)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demonstrativo_gestores(p_de date, p_ate date, p_base text DEFAULT 'competencia')
RETURNS TABLE (
  gestor_id uuid, pedidos bigint, bruto numeric, tarifa numeric, desconto numeric,
  comissao numeric, devido numeric, repassado numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lt.gestor_id,
         count(DISTINCT lt.pedido_id) FILTER (WHERE lt.tipo = 'recebimento'),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.natureza = 'D' AND l.conta_codigo IN ('1.1.01', '3.1.01')), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo = '3.1.01'), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo = '3.1.02'), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo = '4.1.01'), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo = '2.1.01' AND l.natureza = 'C'), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.repasse_id IS NOT NULL AND l.conta_codigo = '2.1.01' AND l.natureza = 'D'), 0)
         - COALESCE(sum(l.valor) FILTER (WHERE lt.repasse_id IS NOT NULL AND l.conta_codigo = '2.1.01' AND l.natureza = 'C'), 0)
    FROM lancamento_lote lt
    JOIN lancamento_financeiro l ON l.lote_id = lt.id
   WHERE lt.gestor_id IS NOT NULL
     AND (CASE WHEN p_base = 'caixa' THEN lt.data_caixa ELSE lt.data_competencia END) BETWEEN p_de AND p_ate
   GROUP BY lt.gestor_id;
$$;

-- ------------------------------------------------------------
-- 10. Permissões das funções: só o servidor (service role) chama.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.registrar_lancamentos(text, text, text, uuid, uuid, uuid, uuid, date, date, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lancar_recebimento_pagamento(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_repasse(uuid, uuid, uuid[], text, timestamptz, text, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_repasse(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.balancete(date, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demonstrativo_gestores(date, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_gestor_recebimento(uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_lancamentos(text, text, text, uuid, uuid, uuid, uuid, date, date, uuid, uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.lancar_recebimento_pagamento(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_repasse(uuid, uuid, uuid[], text, timestamptz, text, text, uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_repasse(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.balancete(date, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.demonstrativo_gestores(date, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.salvar_gestor_recebimento(uuid, jsonb) TO service_role;

-- ------------------------------------------------------------
-- 11. Aviso no sino do painel quando o repasse é registrado.
--     A lista repete a vigente (20261102) e acrescenta o tipo novo.
-- ------------------------------------------------------------
ALTER TABLE public.notificacao DROP CONSTRAINT notificacao_tipo_valido;
ALTER TABLE public.notificacao ADD CONSTRAINT notificacao_tipo_valido CHECK (tipo IN (
  'reserva_solicitada',
  'reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida',
  'aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso', 'mensagem',
  'documento_vencendo', 'cobranca_avulsa', 'lembrete_passeio',
  'perfil_operador_aprovado', 'perfil_operador_ajustes',
  'repasse_realizado'
));

-- ------------------------------------------------------------
-- 12. Backfill: pagamentos já recebidos ganham seus lançamentos.
--     Falha em um pagamento não impede a migration (a conciliação mostra o que faltou).
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.pagamento WHERE status = 'recebido' ORDER BY recebido_em LOOP
    BEGIN
      PERFORM public.lancar_recebimento_pagamento(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill: pagamento % não lançado (%)', r.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
