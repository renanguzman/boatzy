-- ============================================================
-- Notificações do cliente no idioma do site (26/10/2026) — SPEC §94.10.
--
-- O site passou a ter pt-BR, en-US e es. As notificações do cliente eram
-- gravadas já como texto em português (titulo/mensagem), montado pelos
-- triggers. Agora cada notificação do cliente também grava, em `dados`, os
-- valores que formam o texto — o site monta título e mensagem no idioma de
-- quem lê a partir de `tipo` + `dados`:
--
--   reserva_confirmada / _cancelada / _expirada  { item, data }
--   reserva_recusada                             { item, data, recado }
--   reserva_concluida                            { item }
--   aguardando_pagamento                         { item, data, prazo }
--   pagamento_aprovado                           { item, data, numero }
--   reembolso                                    { item, numero, parcial }
--   pagamento_recusado                           { item, prazo }
--   mensagem                                     { remetente }  (o texto é a própria mensagem)
--
-- `data` = 'AAAA-MM-DD' (data do passeio); `prazo` = instante (timestamptz);
-- `item` = nome do roteiro (null se não houver — o site usa "seu passeio").
-- titulo/mensagem continuam gravados em pt-BR (painel, admin, e-mails e
-- notificações antigas sem `dados`). As do gestor (sino do painel) seguem só
-- em pt-BR, sem `dados`.
--
-- Coluna nova em tabela existente: não precisa de GRANT.
-- ============================================================

ALTER TABLE public.notificacao ADD COLUMN IF NOT EXISTS dados jsonb;

COMMENT ON COLUMN public.notificacao.dados IS
  'Valores do texto (cliente) para o site montar título/mensagem no idioma — ver migration 20261026b.';

-- Nome do roteiro da reserva, sem o fallback em português (o site traduz o "seu passeio").
CREATE OR REPLACE FUNCTION public.notificacao_item_nome_ou_nulo(p_reserva_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ro.nome, r.item_nome)
  FROM public.reserva r
  LEFT JOIN public.roteiro ro ON ro.id = r.roteiro_id
  WHERE r.id = p_reserva_id;
$$;

REVOKE EXECUTE ON FUNCTION public.notificacao_item_nome_ou_nulo(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- notificar() ganha p_dados (troca a assinatura: a antiga sai para não haver ambiguidade)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.notificar(uuid, text, text, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.notificar(
  p_user_id    uuid,
  p_tipo       text,
  p_titulo     text,
  p_mensagem   text,
  p_link       text,
  p_reserva_id uuid,
  p_chave      text,
  p_dados      jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, reserva_id, chave, dados)
  VALUES (p_user_id, p_tipo, p_titulo, p_mensagem, p_link, p_reserva_id, p_chave, p_dados)
  ON CONFLICT (user_id, chave) WHERE chave IS NOT NULL DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar(uuid, text, text, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Reserva (mesma regra de 20261025b, com `dados` nos avisos do cliente)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item text := public.notificacao_item_nome(NEW.id);
  v_data text := to_char(NEW.data_reserva, 'DD/MM/YYYY');
  v_link text := '/minhas-reservas#reserva-' || NEW.id;
  v_chave text := 'reserva:' || NEW.id || ':' || NEW.status::text;
  v_dados jsonb := jsonb_build_object(
    'item', public.notificacao_item_nome_ou_nulo(NEW.id),
    'data', to_char(NEW.data_reserva, 'YYYY-MM-DD'));
BEGIN
  -- Saiu de "pendente": a solicitação foi respondida (ou cancelada) — o aviso do gestor fica lido.
  IF OLD.status::text = 'pendente' THEN
    UPDATE public.notificacao
       SET lida_em = now()
     WHERE user_id = NEW.owner_id
       AND publico = 'gestor'
       AND tipo = 'reserva_solicitada'
       AND reserva_id = NEW.id
       AND lida_em IS NULL;
  END IF;

  CASE NEW.status::text
    WHEN 'confirmada' THEN
      -- Pago pelo Boatzy: o aviso é "Pagamento aprovado" (trigger do pedido).
      IF OLD.status::text = 'aguardando_pagamento' THEN RETURN NEW; END IF;
      PERFORM public.notificar(NEW.cliente_id, 'reserva_confirmada', 'Reserva confirmada',
        format('O gestor confirmou sua reserva de %s para %s. Bom passeio!', v_item, v_data),
        v_link, NEW.id, v_chave, v_dados);
    WHEN 'recusada' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_recusada', 'Reserva não aceita',
        format('O gestor não pôde aceitar sua solicitação de %s para %s.', v_item, v_data)
          || CASE WHEN NULLIF(btrim(NEW.observacao_gestor), '') IS NOT NULL
                  THEN ' Recado do gestor: "' || left(btrim(NEW.observacao_gestor), 200) || '"'
                  ELSE '' END,
        v_link, NEW.id, v_chave,
        v_dados || jsonb_build_object('recado', left(NULLIF(btrim(NEW.observacao_gestor), ''), 200)));
    WHEN 'cancelada' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_cancelada', 'Reserva cancelada',
        format('Sua reserva de %s para %s foi cancelada.', v_item, v_data),
        v_link, NEW.id, v_chave, v_dados);
      -- Só o cliente cancela (Minhas reservas).
      PERFORM public.notificar_gestor(NEW.owner_id, 'reserva_cancelada', 'Reserva cancelada pelo cliente',
        format('%s cancelou a reserva de %s para %s.', public.notificacao_cliente_nome(NEW.id), v_item, v_data),
        NEW.id, v_chave);
    WHEN 'expirada' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_expirada', 'Prazo de pagamento expirado',
        format('O prazo para pagar %s (%s) terminou e a solicitação expirou. Nenhum valor foi cobrado.', v_item, v_data),
        v_link, NEW.id, v_chave, v_dados);
      PERFORM public.notificar_gestor(NEW.owner_id, 'reserva_expirada', 'Pagamento não feito no prazo',
        format('%s não pagou %s (%s) dentro do prazo e a solicitação expirou. A data voltou a ficar disponível.',
          public.notificacao_cliente_nome(NEW.id), v_item, v_data),
        NEW.id, v_chave);
    WHEN 'concluida' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_concluida', 'Como foi seu passeio?',
        format('Conte como foi %s — sua avaliação ajuda outros navegantes.', v_item),
        v_link, NEW.id, v_chave, v_dados - 'data');
    ELSE
      NULL;
  END CASE;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Pedido (mesma regra de 20261025b, com `dados` nos avisos do cliente)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item text := public.notificacao_item_nome(NEW.reserva_id);
  v_item_dados text := public.notificacao_item_nome_ou_nulo(NEW.reserva_id);
  v_data text;
  v_data_iso text;
  v_prazo text := to_char(NEW.expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
BEGIN
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

-- ------------------------------------------------------------
-- Pagamento recusado (mesma regra de 20261025b, com `dados` no aviso do cliente)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedido%ROWTYPE;
  v_item text;
  v_prazo text;
BEGIN
  SELECT * INTO v_pedido FROM public.pedido WHERE id = NEW.pedido_id;
  -- Só interessa enquanto o cliente ainda pode pagar.
  IF v_pedido.id IS NULL OR v_pedido.status <> 'aguardando_pagamento' THEN RETURN NEW; END IF;

  v_item := public.notificacao_item_nome(v_pedido.reserva_id);
  v_prazo := COALESCE(to_char(v_pedido.expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), 'o fim do prazo');

  PERFORM public.notificar(v_pedido.cliente_id, 'pagamento_recusado', 'Pagamento recusado',
    format('O pagamento de %s não foi aprovado. Você ainda pode pagar com outro cartão ou Pix até %s.', v_item, v_prazo),
    '/reservas/' || v_pedido.reserva_id || '/pagar', v_pedido.reserva_id, 'pagamento:' || NEW.id || ':recusado',
    jsonb_build_object('item', public.notificacao_item_nome_ou_nulo(v_pedido.reserva_id), 'prazo', v_pedido.expira_em));
  PERFORM public.notificar_gestor(v_pedido.gestor_id, 'pagamento_recusado', 'Pagamento do cliente recusado',
    format('O pagamento de %s (%s) não foi aprovado. O cliente ainda pode pagar com outro cartão ou Pix até %s.',
      v_item, public.notificacao_cliente_nome(v_pedido.reserva_id), v_prazo),
    v_pedido.reserva_id, 'pagamento:' || NEW.id || ':recusado');
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Chat (mesma regra de 20261023, com o remetente em `dados`)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_nome text;
BEGIN
  SELECT c.cliente_id INTO v_cliente FROM public.conversa c WHERE c.id = NEW.conversa_id;
  IF v_cliente IS NULL OR NEW.remetente_id = v_cliente THEN RETURN NEW; END IF;

  SELECT NULLIF(btrim(u.name), '') INTO v_nome FROM public.users u WHERE u.id = NEW.remetente_id;

  INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, conversa_id, dados)
  VALUES (v_cliente, 'mensagem', 'Nova mensagem de ' || COALESCE(v_nome, 'o dono da embarcação'),
          left(NEW.conteudo, 160), '/minhas-conversas/' || NEW.conversa_id || '/chat', NEW.conversa_id,
          jsonb_build_object('remetente', v_nome))
  ON CONFLICT (user_id, conversa_id) WHERE tipo = 'mensagem' AND lida_em IS NULL
  DO UPDATE SET titulo     = EXCLUDED.titulo,
                mensagem   = EXCLUDED.mensagem,
                dados      = EXCLUDED.dados,
                quantidade = public.notificacao.quantidade + 1,
                criada_em  = now();
  RETURN NEW;
END;
$$;

-- Datas/horas no horário de Brasília (AGENTS.md → Datas e fuso horário). CREATE OR REPLACE
-- descarta o SET da versão anterior: reaplica.
ALTER FUNCTION public.trg_notificacao_reserva() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.trg_notificacao_pedido() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.trg_notificacao_pagamento() SET timezone = 'America/Sao_Paulo';

-- ------------------------------------------------------------
-- Backfill: notificações do cliente já existentes ganham `dados`
-- ------------------------------------------------------------
UPDATE public.notificacao n
   SET dados = jsonb_build_object(
         'item', public.notificacao_item_nome_ou_nulo(r.id),
         'data', to_char(r.data_reserva, 'YYYY-MM-DD'))
       || CASE WHEN n.tipo = 'reserva_recusada'
               THEN jsonb_build_object('recado', left(NULLIF(btrim(r.observacao_gestor), ''), 200))
               ELSE '{}'::jsonb END
  FROM public.reserva r
 WHERE r.id = n.reserva_id
   AND n.publico = 'cliente'
   AND n.dados IS NULL
   AND n.tipo IN ('reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida');

UPDATE public.notificacao n
   SET dados = jsonb_build_object(
         'item', public.notificacao_item_nome_ou_nulo(p.reserva_id),
         'data', to_char(r.data_reserva, 'YYYY-MM-DD'),
         'prazo', p.expira_em,
         'numero', p.numero,
         'parcial', n.titulo LIKE 'Reembolso parcial%')
  FROM public.pedido p
  JOIN public.reserva r ON r.id = p.reserva_id
 WHERE p.reserva_id = n.reserva_id
   AND n.publico = 'cliente'
   AND n.dados IS NULL
   AND n.tipo IN ('aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso');

UPDATE public.notificacao n
   SET dados = jsonb_build_object('remetente', NULLIF(substring(n.titulo FROM '^Nova mensagem de (.*)$'), 'o dono da embarcação'))
 WHERE n.publico = 'cliente'
   AND n.tipo = 'mensagem'
   AND n.dados IS NULL;
