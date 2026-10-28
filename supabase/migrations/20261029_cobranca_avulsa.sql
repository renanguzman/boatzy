-- ============================================================
-- Cobrança avulsa vinculada à reserva (29/10/2026) — SPEC §34.16.
--
-- Depois de uma reserva confirmada (ou concluída), o gestor pode cobrar do
-- cliente um valor extra — produto/serviço do catálogo ou item livre (taxa,
-- consumo, dano…). A cobrança é um `pedido` de tipo 'avulso': reaproveita
-- pagamento / pagamento_transacao / parcela / cartão / webhook / cron / admin.
--
--   pedido.tipo        'reserva' (1 por reserva, como antes) | 'avulso' (N por reserva)
--   pedido.reserva_id  só no tipo 'reserva' (continua UNIQUE — os embeds
--                      `reserva → pedido(...)` seguem 1:1 e nunca trazem avulsas)
--   pedido_avulso      1:1 com o pedido avulso: reserva de origem, título,
--                      formas e parcelas permitidas pelo gestor, ajuste do total
--   pedido_item        itens discriminados (snapshot do catálogo ou livres)
--   pedido_evento      linha do tempo de negócio (append-only) — reserva e avulso
--
-- Decisões (PRD §6.7): comissão = taxa congelada da reserva, paga pelo cliente
-- (chave `avulso_cobrar_comissao`); parcelas limitadas ao máximo global;
-- emissão em reserva confirmada/concluída até N dias após o passeio; cobrança
-- imutável depois de emitida (cancela e emite outra); só o gestor dono emite.
-- ============================================================

-- ------------------------------------------------------------
-- pedido: tipo + reserva_id opcional (só no avulso)
-- ------------------------------------------------------------
ALTER TABLE public.pedido
  ADD COLUMN tipo text NOT NULL DEFAULT 'reserva',
  ADD CONSTRAINT pedido_tipo_valido CHECK (tipo IN ('reserva', 'avulso'));

ALTER TABLE public.pedido ALTER COLUMN reserva_id DROP NOT NULL;

ALTER TABLE public.pedido
  ADD CONSTRAINT pedido_tipo_reserva_coerente CHECK ((tipo = 'reserva') = (reserva_id IS NOT NULL));

CREATE INDEX pedido_tipo_status_idx ON public.pedido (tipo, status);

-- ------------------------------------------------------------
-- financeiro_config: regras da cobrança avulsa
-- ------------------------------------------------------------
ALTER TABLE public.financeiro_config
  ADD COLUMN avulso_prazo_padrao_horas integer NOT NULL DEFAULT 72,
  ADD COLUMN avulso_prazo_max_dias     integer NOT NULL DEFAULT 15,
  ADD COLUMN avulso_dias_apos_passeio  integer NOT NULL DEFAULT 30,
  ADD COLUMN avulso_cobrar_comissao    boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT financeiro_config_avulso_prazo_padrao_valido CHECK (avulso_prazo_padrao_horas BETWEEN 1 AND 1440),
  ADD CONSTRAINT financeiro_config_avulso_prazo_max_valido CHECK (avulso_prazo_max_dias BETWEEN 1 AND 60),
  ADD CONSTRAINT financeiro_config_avulso_janela_valida CHECK (avulso_dias_apos_passeio BETWEEN 0 AND 365);

-- ------------------------------------------------------------
-- pedido_avulso — configuração da cobrança avulsa (1:1 com o pedido)
-- ------------------------------------------------------------
CREATE TABLE public.pedido_avulso (
  pedido_id          uuid           PRIMARY KEY REFERENCES public.pedido(id) ON DELETE CASCADE,
  reserva_id         uuid           NOT NULL REFERENCES public.reserva(id) ON DELETE RESTRICT,
  titulo             text           NOT NULL,
  mensagem_cliente   text,
  formas_permitidas  text[]         NOT NULL,
  parcelas_max       smallint       NOT NULL DEFAULT 1,
  valor_calculado    numeric(12,2)  NOT NULL,              -- soma dos itens
  valor_ajuste       numeric(12,2)  NOT NULL DEFAULT 0,    -- total editado pelo gestor − soma dos itens
  motivo_ajuste      text,
  criado_por         uuid           REFERENCES public.users(id) ON DELETE SET NULL,
  link_copiado_em    timestamptz,
  visualizado_em     timestamptz,
  criado_em          timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pedido_avulso_titulo_valido CHECK (char_length(btrim(titulo)) BETWEEN 2 AND 120),
  CONSTRAINT pedido_avulso_mensagem_valida CHECK (mensagem_cliente IS NULL OR char_length(mensagem_cliente) <= 1000),
  CONSTRAINT pedido_avulso_formas_validas CHECK (
    cardinality(formas_permitidas) >= 1 AND formas_permitidas <@ ARRAY['pix', 'cartao_credito']::text[]
  ),
  CONSTRAINT pedido_avulso_parcelas_validas CHECK (
    parcelas_max BETWEEN 1 AND 12 AND (parcelas_max = 1 OR 'cartao_credito' = ANY (formas_permitidas))
  ),
  CONSTRAINT pedido_avulso_valor_valido CHECK (valor_calculado >= 0 AND valor_calculado + valor_ajuste > 0),
  CONSTRAINT pedido_avulso_ajuste_motivado CHECK (valor_ajuste = 0 OR NULLIF(btrim(motivo_ajuste), '') IS NOT NULL)
);

CREATE INDEX pedido_avulso_reserva_idx ON public.pedido_avulso (reserva_id, criado_em DESC);

-- ------------------------------------------------------------
-- pedido_item — itens discriminados do pedido (snapshot)
-- ------------------------------------------------------------
CREATE TABLE public.pedido_item (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid           NOT NULL REFERENCES public.pedido(id) ON DELETE CASCADE,
  ordem           smallint       NOT NULL DEFAULT 0,
  origem          text           NOT NULL,                 -- 'catalogo' | 'livre'
  catalogo_id     uuid           REFERENCES public.catalogo(id) ON DELETE SET NULL,
  tipo            text           NOT NULL,                 -- 'produto' | 'servico' | 'taxa' | 'outro'
  descricao       text           NOT NULL,
  quantidade      numeric(10,2)  NOT NULL DEFAULT 1,
  valor_unitario  numeric(12,2)  NOT NULL,
  valor_total     numeric(12,2)  NOT NULL,
  criado_em       timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT pedido_item_origem_valida CHECK (origem IN ('catalogo', 'livre')),
  CONSTRAINT pedido_item_tipo_valido CHECK (tipo IN ('produto', 'servico', 'taxa', 'outro')),
  CONSTRAINT pedido_item_descricao_valida CHECK (char_length(btrim(descricao)) BETWEEN 1 AND 200),
  CONSTRAINT pedido_item_quantidade_valida CHECK (quantidade > 0 AND quantidade <= 9999),
  CONSTRAINT pedido_item_valores_validos CHECK (valor_unitario >= 0 AND valor_total >= 0),
  -- Tolerância de 1 centavo: o servidor arredonda em JS (ponto flutuante) com quantidade fracionada.
  CONSTRAINT pedido_item_total_coerente CHECK (abs(valor_total - round(quantidade * valor_unitario, 2)) <= 0.01)
);

CREATE INDEX pedido_item_pedido_idx ON public.pedido_item (pedido_id, ordem);

-- ------------------------------------------------------------
-- pedido_evento — linha do tempo de negócio do pedido (append-only).
-- Complementa `pagamento_transacao` (o que vem do Asaas) e
-- `financeiro_auditoria` (ações do admin).
-- ------------------------------------------------------------
CREATE TABLE public.pedido_evento (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   uuid         NOT NULL REFERENCES public.pedido(id) ON DELETE CASCADE,
  evento      text         NOT NULL,      -- criado, link_copiado, visualizado, email_enviado, pago, expirado, cancelado…
  ator_id     uuid         REFERENCES public.users(id) ON DELETE SET NULL,
  ator_papel  text         NOT NULL DEFAULT 'sistema',
  dados       jsonb,
  criado_em   timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT pedido_evento_formato CHECK (evento ~ '^[a-z_]{3,40}$'),
  CONSTRAINT pedido_evento_ator_valido CHECK (ator_papel IN ('gestor', 'cliente', 'admin', 'sistema'))
);

CREATE INDEX pedido_evento_pedido_idx ON public.pedido_evento (pedido_id, criado_em);

CREATE TRIGGER pedido_evento_sem_update BEFORE UPDATE OR DELETE ON public.pedido_evento
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditoria_imutavel();
CREATE TRIGGER pedido_evento_sem_truncate BEFORE TRUNCATE ON public.pedido_evento
  FOR EACH STATEMENT EXECUTE FUNCTION public.financeiro_auditoria_imutavel();

-- O DELETE em cascata a partir do pedido também seria recusado — o que é
-- desejado: pedido é registro financeiro e nunca é apagado (FKs RESTRICT).

-- ------------------------------------------------------------
-- RLS + GRANTs (AGENTS.md). Escritas só pelo servidor (service role).
-- ------------------------------------------------------------
ALTER TABLE public.pedido_avulso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_item   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_evento ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_avulso, public.pedido_item, public.pedido_evento
  TO anon, authenticated, service_role;

CREATE POLICY "service_role_all" ON public.pedido_avulso FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pedido_item   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pedido_evento FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "participante_select" ON public.pedido_avulso FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido p WHERE p.id = pedido_id
                 AND (p.cliente_id = auth.uid() OR p.gestor_id = auth.uid())));

CREATE POLICY "participante_select" ON public.pedido_item FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido p WHERE p.id = pedido_id
                 AND (p.cliente_id = auth.uid() OR p.gestor_id = auth.uid())));

-- pedido_evento: só servidor/admin (sem policy para authenticated).

-- ------------------------------------------------------------
-- criar_pedido_avulso — grava pedido + pedido_avulso + itens + evento numa
-- transação só e avisa o cliente. As regras de negócio (posse, status da
-- reserva, janela, formas, valores) são validadas no servidor antes
-- (src/lib/pagamentos/avulso.ts); aqui ficam as garantias de integridade.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_pedido_avulso(
  p_reserva_id          uuid,
  p_gestor_id           uuid,
  p_titulo              text,
  p_mensagem            text,
  p_formas              text[],
  p_parcelas_max        smallint,
  p_valor_calculado     numeric,
  p_valor_ajuste        numeric,
  p_motivo_ajuste       text,
  p_valor_itens         numeric,
  p_comissao_percentual numeric,
  p_valor_comissao      numeric,
  p_valor_total         numeric,
  p_expira_em           timestamptz,
  p_itens               jsonb
) RETURNS TABLE (id uuid, numero bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserva public.reserva%ROWTYPE;
  v_pedido_id uuid;
  v_numero bigint;
  v_item jsonb;
  v_ordem smallint := 0;
BEGIN
  SELECT * INTO v_reserva FROM public.reserva r WHERE r.id = p_reserva_id FOR SHARE;
  IF v_reserva.id IS NULL OR v_reserva.owner_id <> p_gestor_id THEN
    RAISE EXCEPTION 'reserva_invalida' USING ERRCODE = 'P0001';
  END IF;
  IF v_reserva.status::text NOT IN ('confirmada', 'concluida') THEN
    RAISE EXCEPTION 'reserva_status_invalido' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'itens_invalidos' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.pedido (tipo, reserva_id, cliente_id, gestor_id, valor_itens, comissao_percentual,
                             valor_comissao, valor_desconto, valor_total, expira_em)
  VALUES ('avulso', NULL, v_reserva.cliente_id, p_gestor_id, p_valor_itens, p_comissao_percentual,
          p_valor_comissao, 0, p_valor_total, p_expira_em)
  RETURNING pedido.id, pedido.numero INTO v_pedido_id, v_numero;

  INSERT INTO public.pedido_avulso (pedido_id, reserva_id, titulo, mensagem_cliente, formas_permitidas, parcelas_max,
                                    valor_calculado, valor_ajuste, motivo_ajuste, criado_por)
  VALUES (v_pedido_id, p_reserva_id, btrim(p_titulo), NULLIF(btrim(p_mensagem), ''), p_formas, p_parcelas_max,
          p_valor_calculado, p_valor_ajuste, NULLIF(btrim(p_motivo_ajuste), ''), p_gestor_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    INSERT INTO public.pedido_item (pedido_id, ordem, origem, catalogo_id, tipo, descricao, quantidade,
                                    valor_unitario, valor_total)
    VALUES (v_pedido_id, v_ordem, v_item->>'origem', NULLIF(v_item->>'catalogo_id', '')::uuid, v_item->>'tipo',
            btrim(v_item->>'descricao'), (v_item->>'quantidade')::numeric, (v_item->>'valor_unitario')::numeric,
            (v_item->>'valor_total')::numeric);
    v_ordem := v_ordem + 1;
  END LOOP;

  INSERT INTO public.pedido_evento (pedido_id, evento, ator_id, ator_papel, dados)
  VALUES (v_pedido_id, 'criado', p_gestor_id, 'gestor', jsonb_build_object(
    'valor_total', p_valor_total, 'formas', to_jsonb(p_formas), 'parcelas_max', p_parcelas_max,
    'expira_em', p_expira_em, 'itens', jsonb_array_length(p_itens)));

  PERFORM public.notificar(v_reserva.cliente_id, 'cobranca_avulsa', 'Nova cobrança do seu passeio',
    format('%s enviou uma cobrança de %s referente a %s (%s). Pague até %s.',
      COALESCE((SELECT NULLIF(btrim(u.name), '') FROM public.users u WHERE u.id = p_gestor_id), 'O gestor'),
      btrim(p_titulo), public.notificacao_item_nome(p_reserva_id), to_char(v_reserva.data_reserva, 'DD/MM/YYYY'),
      to_char(p_expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')),
    '/cobrancas/' || v_pedido_id, p_reserva_id, 'pedido:' || v_pedido_id || ':criado',
    jsonb_build_object('evento', 'criada', 'item', public.notificacao_item_nome_ou_nulo(p_reserva_id),
      'data', to_char(v_reserva.data_reserva, 'YYYY-MM-DD'), 'prazo', p_expira_em, 'numero', v_numero,
      'titulo', btrim(p_titulo)));

  RETURN QUERY SELECT v_pedido_id, v_numero;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_pedido_avulso(uuid, uuid, text, text, text[], smallint, numeric, numeric, text,
  numeric, numeric, numeric, numeric, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_avulso(uuid, uuid, text, text, text[], smallint, numeric, numeric, text,
  numeric, numeric, numeric, numeric, timestamptz, jsonb) TO service_role;

-- ------------------------------------------------------------
-- Notificações: novo tipo + avisos do pedido avulso
-- ------------------------------------------------------------
ALTER TABLE public.notificacao DROP CONSTRAINT notificacao_tipo_valido;
ALTER TABLE public.notificacao ADD CONSTRAINT notificacao_tipo_valido CHECK (tipo IN (
  'reserva_solicitada',
  'reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida',
  'aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso', 'mensagem',
  'documento_vencendo', 'cobranca_avulsa'
));

-- Pedido: mesmas regras de 20261026b para o pedido da reserva; o avulso
-- avisa pela cobrança (criação vem da função criar_pedido_avulso).
CREATE OR REPLACE FUNCTION public.trg_notificacao_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item text;
  v_item_dados text;
  v_data text;
  v_data_iso text;
  v_prazo text := to_char(NEW.expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
  v_avulso public.pedido_avulso%ROWTYPE;
  v_link text;
BEGIN
  IF NEW.tipo = 'avulso' THEN
    IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
    SELECT * INTO v_avulso FROM public.pedido_avulso a WHERE a.pedido_id = NEW.id;
    IF v_avulso.pedido_id IS NULL THEN RETURN NEW; END IF;
    v_item := public.notificacao_item_nome(v_avulso.reserva_id);
    v_item_dados := public.notificacao_item_nome_ou_nulo(v_avulso.reserva_id);
    v_link := '/cobrancas/' || NEW.id;

    IF NEW.status = 'pago' THEN
      PERFORM public.notificar(NEW.cliente_id, 'pagamento_aprovado', 'Pagamento aprovado',
        format('Recebemos o pagamento da cobrança #%s (%s), referente a %s.', NEW.numero, v_avulso.titulo, v_item),
        v_link, v_avulso.reserva_id, 'pedido:' || NEW.id || ':pago',
        jsonb_build_object('item', v_item_dados, 'numero', NEW.numero, 'titulo', v_avulso.titulo, 'avulso', true));
      PERFORM public.notificar_gestor(NEW.gestor_id, 'pagamento_aprovado', 'Cobrança adicional paga',
        format('%s pagou a cobrança #%s (%s) de %s.',
          public.notificacao_cliente_nome(v_avulso.reserva_id), NEW.numero, v_avulso.titulo, v_item),
        v_avulso.reserva_id, 'pedido:' || NEW.id || ':pago');
    ELSIF NEW.status IN ('reembolsado', 'reembolsado_parcial') THEN
      PERFORM public.notificar(NEW.cliente_id, 'reembolso',
        CASE WHEN NEW.status = 'reembolsado' THEN 'Reembolso realizado' ELSE 'Reembolso parcial realizado' END,
        format('O valor da cobrança #%s (%s) foi estornado. O prazo para aparecer no extrato depende do seu banco ou cartão.',
          NEW.numero, v_avulso.titulo),
        v_link, v_avulso.reserva_id, 'pedido:' || NEW.id || ':' || NEW.status,
        jsonb_build_object('item', v_avulso.titulo, 'numero', NEW.numero, 'parcial', NEW.status = 'reembolsado_parcial'));
      PERFORM public.notificar_gestor(NEW.gestor_id, 'reembolso',
        CASE WHEN NEW.status = 'reembolsado' THEN 'Reembolso ao cliente' ELSE 'Reembolso parcial ao cliente' END,
        format('A cobrança #%s (%s, de %s) foi estornada %s.', NEW.numero, v_avulso.titulo,
          public.notificacao_cliente_nome(v_avulso.reserva_id),
          CASE WHEN NEW.status = 'reembolsado' THEN 'integralmente' ELSE 'parcialmente' END),
        v_avulso.reserva_id, 'pedido:' || NEW.id || ':' || NEW.status);
    ELSIF NEW.status IN ('expirado', 'cancelado') THEN
      PERFORM public.notificar(NEW.cliente_id, 'cobranca_avulsa',
        CASE WHEN NEW.status = 'expirado' THEN 'Cobrança expirada' ELSE 'Cobrança cancelada' END,
        format('A cobrança #%s (%s) de %s foi %s. Nenhum valor foi cobrado.', NEW.numero, v_avulso.titulo, v_item,
          CASE WHEN NEW.status = 'expirado' THEN 'encerrada porque o prazo terminou' ELSE 'cancelada' END),
        v_link, v_avulso.reserva_id, 'pedido:' || NEW.id || ':' || NEW.status,
        jsonb_build_object('evento', CASE WHEN NEW.status = 'expirado' THEN 'expirada' ELSE 'cancelada' END,
          'item', v_item_dados, 'numero', NEW.numero, 'titulo', v_avulso.titulo));
      IF NEW.status = 'expirado' THEN
        PERFORM public.notificar_gestor(NEW.gestor_id, 'cobranca_avulsa', 'Cobrança adicional não paga',
          format('%s não pagou a cobrança #%s (%s) dentro do prazo e ela foi encerrada.',
            public.notificacao_cliente_nome(v_avulso.reserva_id), NEW.numero, v_avulso.titulo),
          v_avulso.reserva_id, 'pedido:' || NEW.id || ':expirado');
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_item := public.notificacao_item_nome(NEW.reserva_id);
  v_item_dados := public.notificacao_item_nome_ou_nulo(NEW.reserva_id);
  SELECT to_char(r.data_reserva, 'DD/MM/YYYY'), to_char(r.data_reserva, 'YYYY-MM-DD')
    INTO v_data, v_data_iso
    FROM public.reserva r WHERE r.id = NEW.reserva_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'aguardando_pagamento' THEN
      PERFORM public.notificar(NEW.cliente_id, 'aguardando_pagamento', 'Reserva aceita — aguardando pagamento',
        format('O gestor aceitou %s para %s. Pague até %s para garantir a data.', v_item, v_data, COALESCE(v_prazo, 'o prazo')),
        '/reservas/' || NEW.reserva_id || '/pagar', NEW.reserva_id, 'pedido:' || NEW.id || ':aguardando_pagamento',
        jsonb_build_object('item', v_item_dados, 'data', v_data_iso, 'prazo', NEW.expira_em));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    PERFORM public.notificar(NEW.cliente_id, 'pagamento_aprovado', 'Pagamento aprovado',
      format('Recebemos o pagamento do pedido #%s. Sua reserva de %s para %s está confirmada.', NEW.numero, v_item, v_data),
      '/minhas-reservas#reserva-' || NEW.reserva_id, NEW.reserva_id, 'pedido:' || NEW.id || ':pago',
      jsonb_build_object('item', v_item_dados, 'data', v_data_iso, 'numero', NEW.numero));
    PERFORM public.notificar_gestor(NEW.gestor_id, 'pagamento_aprovado', 'Pagamento recebido',
      format('%s pagou o pedido #%s. A reserva de %s para %s está confirmada.',
        public.notificacao_cliente_nome(NEW.reserva_id), NEW.numero, v_item, v_data),
      NEW.reserva_id, 'pedido:' || NEW.id || ':pago');
  ELSIF NEW.status IN ('reembolsado', 'reembolsado_parcial') THEN
    PERFORM public.notificar(NEW.cliente_id, 'reembolso',
      CASE WHEN NEW.status = 'reembolsado' THEN 'Reembolso realizado' ELSE 'Reembolso parcial realizado' END,
      format('O valor do pedido #%s (%s) foi estornado. O prazo para aparecer no extrato depende do seu banco ou cartão.', NEW.numero, v_item),
      '/minhas-reservas#reserva-' || NEW.reserva_id, NEW.reserva_id, 'pedido:' || NEW.id || ':' || NEW.status,
      jsonb_build_object('item', v_item_dados, 'numero', NEW.numero, 'parcial', NEW.status = 'reembolsado_parcial'));
    PERFORM public.notificar_gestor(NEW.gestor_id, 'reembolso',
      CASE WHEN NEW.status = 'reembolsado' THEN 'Reembolso ao cliente' ELSE 'Reembolso parcial ao cliente' END,
      format('O pedido #%s (%s para %s, de %s) foi estornado %s.', NEW.numero, v_item, v_data,
        public.notificacao_cliente_nome(NEW.reserva_id),
        CASE WHEN NEW.status = 'reembolsado' THEN 'integralmente' ELSE 'parcialmente' END),
      NEW.reserva_id, 'pedido:' || NEW.id || ':' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

-- Pagamento recusado: link e reserva vêm da cobrança avulsa quando for o caso.
CREATE OR REPLACE FUNCTION public.trg_notificacao_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedido%ROWTYPE;
  v_reserva_id uuid;
  v_titulo text;
  v_item text;
  v_item_dados text;
  v_link text;
  v_prazo text;
BEGIN
  SELECT * INTO v_pedido FROM public.pedido WHERE id = NEW.pedido_id;
  -- Só interessa enquanto o cliente ainda pode pagar.
  IF v_pedido.id IS NULL OR v_pedido.status <> 'aguardando_pagamento' THEN RETURN NEW; END IF;

  IF v_pedido.tipo = 'avulso' THEN
    SELECT a.reserva_id, a.titulo INTO v_reserva_id, v_titulo FROM public.pedido_avulso a WHERE a.pedido_id = v_pedido.id;
    v_item := COALESCE(v_titulo, 'sua cobrança');
    v_item_dados := v_titulo;
    v_link := '/cobrancas/' || v_pedido.id;
  ELSE
    v_reserva_id := v_pedido.reserva_id;
    v_item := public.notificacao_item_nome(v_reserva_id);
    v_item_dados := public.notificacao_item_nome_ou_nulo(v_reserva_id);
    v_link := '/reservas/' || v_reserva_id || '/pagar';
  END IF;
  v_prazo := COALESCE(to_char(v_pedido.expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), 'o fim do prazo');

  PERFORM public.notificar(v_pedido.cliente_id, 'pagamento_recusado', 'Pagamento recusado',
    format('O pagamento de %s não foi aprovado. Você ainda pode pagar com outro cartão ou Pix até %s.', v_item, v_prazo),
    v_link, v_reserva_id, 'pagamento:' || NEW.id || ':recusado',
    jsonb_build_object('item', v_item_dados, 'prazo', v_pedido.expira_em));
  PERFORM public.notificar_gestor(v_pedido.gestor_id, 'pagamento_recusado', 'Pagamento do cliente recusado',
    format('O pagamento de %s (%s) não foi aprovado. O cliente ainda pode pagar com outro cartão ou Pix até %s.',
      v_item, public.notificacao_cliente_nome(v_reserva_id), v_prazo),
    v_reserva_id, 'pagamento:' || NEW.id || ':recusado');
  RETURN NEW;
END;
$$;

-- Datas/horas no horário de Brasília (AGENTS.md). CREATE OR REPLACE descarta o SET anterior: reaplica.
ALTER FUNCTION public.trg_notificacao_pedido() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.trg_notificacao_pagamento() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.criar_pedido_avulso(uuid, uuid, text, text, text[], smallint, numeric, numeric, text,
  numeric, numeric, numeric, numeric, timestamptz, jsonb) SET timezone = 'America/Sao_Paulo';
