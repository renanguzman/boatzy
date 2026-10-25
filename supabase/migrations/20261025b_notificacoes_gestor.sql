-- ============================================================
-- Notificações do gestor (sino do painel) — SPEC §87.
--
-- A tabela `notificacao` (20261023_notificacoes.sql) passa a ter um
-- público: 'cliente' (sino do site, /notificacoes) ou 'gestor' (sino do
-- painel). O mesmo usuário pode ser cliente e gestor — cada sino só lê o
-- seu público.
--
-- O gestor (reserva.owner_id / pedido.gestor_id) passa a receber, em
-- tempo real (Realtime + RLS), os eventos que dependem do cliente ou do
-- pagamento:
--   nova solicitação (função chamada pela aplicação depois que a
--   reserva foi gravada por completo — adicionais, aceite, cupom),
--   cliente cancelou, prazo de pagamento expirou, pagamento aprovado,
--   pagamento recusado e reembolso.
-- O que o próprio gestor faz (aceitar, recusar, confirmar) não gera
-- aviso para ele. Quando a solicitação deixa de estar pendente, o aviso
-- "nova solicitação" fica lido sozinho.
--
-- Chaves do gestor levam o prefixo 'gestor:' — sem colidir com as do
-- cliente quando o gestor reserva o próprio passeio (mesmo user_id).
-- E-mails continuam na aplicação.
-- ============================================================

ALTER TABLE public.notificacao
  ADD COLUMN publico text NOT NULL DEFAULT 'cliente',
  ADD CONSTRAINT notificacao_publico_valido CHECK (publico IN ('cliente', 'gestor'));

ALTER TABLE public.notificacao DROP CONSTRAINT notificacao_tipo_valido;
ALTER TABLE public.notificacao ADD CONSTRAINT notificacao_tipo_valido CHECK (tipo IN (
  'reserva_solicitada',
  'reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida',
  'aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso', 'mensagem'
));

DROP INDEX public.notificacao_nao_lidas_idx;
CREATE INDEX notificacao_nao_lidas_idx ON public.notificacao (user_id, publico) WHERE lida_em IS NULL;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar_gestor(
  p_user_id    uuid,
  p_tipo       text,
  p_titulo     text,
  p_mensagem   text,
  p_reserva_id uuid,
  p_chave      text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notificacao (user_id, publico, tipo, titulo, mensagem, link, reserva_id, chave)
  VALUES (p_user_id, 'gestor', p_tipo, p_titulo, p_mensagem,
          '/painel/agendamentos/' || p_reserva_id, p_reserva_id, 'gestor:' || p_chave)
  ON CONFLICT (user_id, chave) WHERE chave IS NOT NULL DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar_gestor(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Nome do cliente nos avisos do gestor.
CREATE OR REPLACE FUNCTION public.notificacao_cliente_nome(p_reserva_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(u.name), ''), 'O cliente')
  FROM public.reserva r
  LEFT JOIN public.users u ON u.id = r.cliente_id
  WHERE r.id = p_reserva_id;
$$;

REVOKE EXECUTE ON FUNCTION public.notificacao_cliente_nome(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Nova solicitação — chamada por `criarReserva` (service role) depois de
-- gravar adicionais, aceite do termo e cupom: se algo falhar no meio, a
-- reserva é desfeita e o gestor não chega a ser avisado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar_gestor_nova_solicitacao(p_reserva_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.reserva%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.reserva WHERE id = p_reserva_id;
  IF r.id IS NULL OR r.status::text <> 'pendente' THEN RETURN; END IF;

  PERFORM public.notificar_gestor(r.owner_id, 'reserva_solicitada', 'Nova solicitação de reserva',
    format('%s quer reservar %s para %s (%s %s). Responda para garantir a reserva.',
      public.notificacao_cliente_nome(r.id), public.notificacao_item_nome(r.id),
      to_char(r.data_reserva, 'DD/MM/YYYY'), r.quantidade_pessoas,
      CASE WHEN r.quantidade_pessoas = 1 THEN 'pessoa' ELSE 'pessoas' END),
    r.id, 'reserva:' || r.id || ':solicitada');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar_gestor_nova_solicitacao(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_gestor_nova_solicitacao(uuid) TO service_role;

-- ------------------------------------------------------------
-- Reserva: cliente (como antes) + gestor (cancelada / expirada)
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
        v_link, NEW.id, v_chave);
    WHEN 'recusada' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_recusada', 'Reserva não aceita',
        format('O gestor não pôde aceitar sua solicitação de %s para %s.', v_item, v_data)
          || CASE WHEN NULLIF(btrim(NEW.observacao_gestor), '') IS NOT NULL
                  THEN ' Recado do gestor: "' || left(btrim(NEW.observacao_gestor), 200) || '"'
                  ELSE '' END,
        v_link, NEW.id, v_chave);
    WHEN 'cancelada' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_cancelada', 'Reserva cancelada',
        format('Sua reserva de %s para %s foi cancelada.', v_item, v_data),
        v_link, NEW.id, v_chave);
      -- Só o cliente cancela (Minhas reservas).
      PERFORM public.notificar_gestor(NEW.owner_id, 'reserva_cancelada', 'Reserva cancelada pelo cliente',
        format('%s cancelou a reserva de %s para %s.', public.notificacao_cliente_nome(NEW.id), v_item, v_data),
        NEW.id, v_chave);
    WHEN 'expirada' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_expirada', 'Prazo de pagamento expirado',
        format('O prazo para pagar %s (%s) terminou e a solicitação expirou. Nenhum valor foi cobrado.', v_item, v_data),
        v_link, NEW.id, v_chave);
      PERFORM public.notificar_gestor(NEW.owner_id, 'reserva_expirada', 'Pagamento não feito no prazo',
        format('%s não pagou %s (%s) dentro do prazo e a solicitação expirou. A data voltou a ficar disponível.',
          public.notificacao_cliente_nome(NEW.id), v_item, v_data),
        NEW.id, v_chave);
    WHEN 'concluida' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_concluida', 'Como foi seu passeio?',
        format('Conte como foi %s — sua avaliação ajuda outros navegantes.', v_item),
        v_link, NEW.id, v_chave);
    ELSE
      NULL;
  END CASE;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Pedido: cliente (como antes) + gestor (pago / reembolso)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item text := public.notificacao_item_nome(NEW.reserva_id);
  v_data text;
  v_prazo text := to_char(NEW.expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
BEGIN
  SELECT to_char(r.data_reserva, 'DD/MM/YYYY') INTO v_data FROM public.reserva r WHERE r.id = NEW.reserva_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'aguardando_pagamento' THEN
      PERFORM public.notificar(NEW.cliente_id, 'aguardando_pagamento', 'Reserva aceita — aguardando pagamento',
        format('O gestor aceitou %s para %s. Pague até %s para garantir a data.', v_item, v_data, COALESCE(v_prazo, 'o prazo')),
        '/reservas/' || NEW.reserva_id || '/pagar', NEW.reserva_id, 'pedido:' || NEW.id || ':aguardando_pagamento');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pago' THEN
    PERFORM public.notificar(NEW.cliente_id, 'pagamento_aprovado', 'Pagamento aprovado',
      format('Recebemos o pagamento do pedido #%s. Sua reserva de %s para %s está confirmada.', NEW.numero, v_item, v_data),
      '/minhas-reservas#reserva-' || NEW.reserva_id, NEW.reserva_id, 'pedido:' || NEW.id || ':pago');
    PERFORM public.notificar_gestor(NEW.gestor_id, 'pagamento_aprovado', 'Pagamento recebido',
      format('%s pagou o pedido #%s. A reserva de %s para %s está confirmada.',
        public.notificacao_cliente_nome(NEW.reserva_id), NEW.numero, v_item, v_data),
      NEW.reserva_id, 'pedido:' || NEW.id || ':pago');
  ELSIF NEW.status IN ('reembolsado', 'reembolsado_parcial') THEN
    PERFORM public.notificar(NEW.cliente_id, 'reembolso',
      CASE WHEN NEW.status = 'reembolsado' THEN 'Reembolso realizado' ELSE 'Reembolso parcial realizado' END,
      format('O valor do pedido #%s (%s) foi estornado. O prazo para aparecer no extrato depende do seu banco ou cartão.', NEW.numero, v_item),
      '/minhas-reservas#reserva-' || NEW.reserva_id, NEW.reserva_id, 'pedido:' || NEW.id || ':' || NEW.status);
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
-- Pagamento recusado: cliente (como antes) + gestor
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
    '/reservas/' || v_pedido.reserva_id || '/pagar', v_pedido.reserva_id, 'pagamento:' || NEW.id || ':recusado');
  PERFORM public.notificar_gestor(v_pedido.gestor_id, 'pagamento_recusado', 'Pagamento do cliente recusado',
    format('O pagamento de %s (%s) não foi aprovado. O cliente ainda pode pagar com outro cartão ou Pix até %s.',
      v_item, public.notificacao_cliente_nome(v_pedido.reserva_id), v_prazo),
    v_pedido.reserva_id, 'pagamento:' || NEW.id || ':recusado');
  RETURN NEW;
END;
$$;

-- Datas/horas no horário de Brasília (AGENTS.md → Datas e fuso horário).
ALTER FUNCTION public.trg_notificacao_reserva() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.trg_notificacao_pedido() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.trg_notificacao_pagamento() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.notificar_gestor_nova_solicitacao(uuid) SET timezone = 'America/Sao_Paulo';

-- ------------------------------------------------------------
-- Backfill: solicitações já pendentes aparecem no sino do gestor
-- ------------------------------------------------------------
INSERT INTO public.notificacao (user_id, publico, tipo, titulo, mensagem, link, reserva_id, chave, criada_em)
SELECT r.owner_id,
       'gestor',
       'reserva_solicitada',
       'Nova solicitação de reserva',
       format('%s quer reservar %s para %s (%s %s). Responda para garantir a reserva.',
              public.notificacao_cliente_nome(r.id), public.notificacao_item_nome(r.id),
              to_char(r.data_reserva, 'DD/MM/YYYY'), r.quantidade_pessoas,
              CASE WHEN r.quantidade_pessoas = 1 THEN 'pessoa' ELSE 'pessoas' END),
       '/painel/agendamentos/' || r.id,
       r.id,
       'gestor:reserva:' || r.id || ':solicitada',
       r.solicitado_em
FROM public.reserva r
WHERE r.status = 'pendente'
ON CONFLICT DO NOTHING;
