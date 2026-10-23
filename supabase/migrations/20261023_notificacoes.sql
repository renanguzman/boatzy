-- ============================================================
-- Central de notificações do cliente (sino do header + /notificacoes).
--
-- O banco é a fonte das notificações in-app: triggers em reserva,
-- pedido, pagamento e mensagem gravam a notificação na mesma
-- transação da mudança — qualquer caminho (ação do gestor, webhook do
-- Asaas, cron, expiração lazy, admin) gera o aviso. O site recebe as
-- linhas novas em tempo real (Realtime + RLS: cada um só vê as suas).
--
-- Idempotência: eventos de reserva/pedido/pagamento têm `chave` única
-- por usuário (ex.: 'reserva:<id>:confirmada') — repetir a transição
-- não duplica. Mensagens de chat são agrupadas: UMA notificação aberta
-- (não lida) por conversa, atualizada a cada mensagem nova.
--
-- E-mails continuam na aplicação (SPEC §64).
-- ============================================================

CREATE TABLE public.notificacao (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo         text        NOT NULL,
  titulo       text        NOT NULL,
  mensagem     text        NOT NULL,
  link         text,
  reserva_id   uuid        REFERENCES public.reserva(id) ON DELETE CASCADE,
  conversa_id  uuid        REFERENCES public.conversa(id) ON DELETE CASCADE,
  chave        text,
  quantidade   integer     NOT NULL DEFAULT 1,   -- mensagens agrupadas na notificação
  lida_em      timestamptz,
  criada_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificacao_tipo_valido CHECK (tipo IN (
    'reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida',
    'aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso', 'mensagem'
  ))
);

CREATE UNIQUE INDEX notificacao_chave_uniq ON public.notificacao (user_id, chave) WHERE chave IS NOT NULL;
CREATE UNIQUE INDEX notificacao_mensagem_aberta_uniq ON public.notificacao (user_id, conversa_id)
  WHERE tipo = 'mensagem' AND lida_em IS NULL;
CREATE INDEX notificacao_user_idx ON public.notificacao (user_id, criada_em DESC);
CREATE INDEX notificacao_nao_lidas_idx ON public.notificacao (user_id) WHERE lida_em IS NULL;

ALTER TABLE public.notificacao ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacao TO anon, authenticated, service_role;

CREATE POLICY service_role_all ON public.notificacao
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY user_select_own ON public.notificacao
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Marcar como lida é feito pelo próprio usuário (client do browser).
CREATE POLICY user_update_own ON public.notificacao
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacao;

-- ------------------------------------------------------------
-- Helper: grava um evento (idempotente pela chave)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar(
  p_user_id    uuid,
  p_tipo       text,
  p_titulo     text,
  p_mensagem   text,
  p_link       text,
  p_reserva_id uuid,
  p_chave      text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, reserva_id, chave)
  VALUES (p_user_id, p_tipo, p_titulo, p_mensagem, p_link, p_reserva_id, p_chave)
  ON CONFLICT (user_id, chave) WHERE chave IS NOT NULL DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar(uuid, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Nome do passeio exibido nas notificações (nome atual do roteiro; senão o snapshot).
CREATE OR REPLACE FUNCTION public.notificacao_item_nome(p_reserva_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ro.nome, r.item_nome, 'seu passeio')
  FROM public.reserva r
  LEFT JOIN public.roteiro ro ON ro.id = r.roteiro_id
  WHERE r.id = p_reserva_id;
$$;

REVOKE EXECUTE ON FUNCTION public.notificacao_item_nome(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Reserva: confirmada / recusada / cancelada / expirada / concluída
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
    WHEN 'expirada' THEN
      PERFORM public.notificar(NEW.cliente_id, 'reserva_expirada', 'Prazo de pagamento expirado',
        format('O prazo para pagar %s (%s) terminou e a solicitação expirou. Nenhum valor foi cobrado.', v_item, v_data),
        v_link, NEW.id, v_chave);
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

CREATE TRIGGER notificacao_reserva
  AFTER UPDATE OF status ON public.reserva
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_notificacao_reserva();

-- ------------------------------------------------------------
-- Pedido: aguardando pagamento / pago / reembolso
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
  ELSIF NEW.status IN ('reembolsado', 'reembolsado_parcial') THEN
    PERFORM public.notificar(NEW.cliente_id, 'reembolso',
      CASE WHEN NEW.status = 'reembolsado' THEN 'Reembolso realizado' ELSE 'Reembolso parcial realizado' END,
      format('O valor do pedido #%s (%s) foi estornado. O prazo para aparecer no extrato depende do seu banco ou cartão.', NEW.numero, v_item),
      '/minhas-reservas#reserva-' || NEW.reserva_id, NEW.reserva_id, 'pedido:' || NEW.id || ':' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notificacao_pedido_insert
  AFTER INSERT ON public.pedido
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notificacao_pedido();

CREATE TRIGGER notificacao_pedido_status
  AFTER UPDATE OF status ON public.pedido
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_notificacao_pedido();

-- ------------------------------------------------------------
-- Pagamento recusado (cartão negado / reprovado na análise de risco)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedido%ROWTYPE;
BEGIN
  SELECT * INTO v_pedido FROM public.pedido WHERE id = NEW.pedido_id;
  -- Só interessa enquanto o cliente ainda pode pagar.
  IF v_pedido.id IS NULL OR v_pedido.status <> 'aguardando_pagamento' THEN RETURN NEW; END IF;

  PERFORM public.notificar(v_pedido.cliente_id, 'pagamento_recusado', 'Pagamento recusado',
    format('O pagamento de %s não foi aprovado. Você ainda pode pagar com outro cartão ou Pix até %s.',
      public.notificacao_item_nome(v_pedido.reserva_id),
      COALESCE(to_char(v_pedido.expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), 'o fim do prazo')),
    '/reservas/' || v_pedido.reserva_id || '/pagar', v_pedido.reserva_id, 'pagamento:' || NEW.id || ':recusado');
  RETURN NEW;
END;
$$;

CREATE TRIGGER notificacao_pagamento_recusado
  AFTER UPDATE OF status ON public.pagamento
  FOR EACH ROW
  WHEN (NEW.status = 'recusado' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_notificacao_pagamento();

-- ------------------------------------------------------------
-- Chat: mensagem do gestor/equipe para o cliente (agrupada por conversa)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_remetente text;
BEGIN
  SELECT c.cliente_id INTO v_cliente FROM public.conversa c WHERE c.id = NEW.conversa_id;
  IF v_cliente IS NULL OR NEW.remetente_id = v_cliente THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(btrim(u.name), ''), 'o dono da embarcação') INTO v_remetente
  FROM public.users u WHERE u.id = NEW.remetente_id;

  INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, conversa_id)
  VALUES (v_cliente, 'mensagem', 'Nova mensagem de ' || COALESCE(v_remetente, 'o dono da embarcação'),
          left(NEW.conteudo, 160), '/minhas-conversas/' || NEW.conversa_id || '/chat', NEW.conversa_id)
  ON CONFLICT (user_id, conversa_id) WHERE tipo = 'mensagem' AND lida_em IS NULL
  DO UPDATE SET titulo     = EXCLUDED.titulo,
                mensagem   = EXCLUDED.mensagem,
                quantidade = public.notificacao.quantidade + 1,
                criada_em  = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER notificacao_mensagem
  AFTER INSERT ON public.mensagem
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notificacao_mensagem();

-- Leu a conversa (qualquer tela de chat) → a notificação da conversa fica lida.
CREATE OR REPLACE FUNCTION public.trg_notificacao_mensagem_lida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notificacao
     SET lida_em = now()
   WHERE tipo = 'mensagem'
     AND conversa_id = NEW.conversa_id
     AND user_id <> NEW.remetente_id
     AND lida_em IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notificacao_mensagem_lida
  AFTER UPDATE OF lida_em ON public.mensagem
  FOR EACH ROW
  WHEN (OLD.lida_em IS NULL AND NEW.lida_em IS NOT NULL)
  EXECUTE FUNCTION public.trg_notificacao_mensagem_lida();

-- Datas/horas exibidas no horário de Brasília (AGENTS.md → Datas e fuso horário).
ALTER FUNCTION public.trg_notificacao_reserva() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.trg_notificacao_pedido() SET timezone = 'America/Sao_Paulo';
ALTER FUNCTION public.trg_notificacao_pagamento() SET timezone = 'America/Sao_Paulo';

-- ------------------------------------------------------------
-- Backfill: o que o cliente já tem pendente aparece no sino desde o 1º acesso
-- ------------------------------------------------------------

-- Conversas com mensagens não lidas do gestor/equipe (uma por conversa).
INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, conversa_id, quantidade, criada_em)
SELECT DISTINCT ON (c.id)
       c.cliente_id,
       'mensagem',
       'Nova mensagem de ' || COALESCE(NULLIF(btrim(u.name), ''), 'o dono da embarcação'),
       left(m.conteudo, 160),
       '/minhas-conversas/' || c.id || '/chat',
       c.id,
       count(*) OVER (PARTITION BY c.id),
       m.created_at
FROM public.mensagem m
JOIN public.conversa c ON c.id = m.conversa_id
LEFT JOIN public.users u ON u.id = m.remetente_id
WHERE m.lida_em IS NULL
  AND m.remetente_id <> c.cliente_id
ORDER BY c.id, m.created_at DESC
ON CONFLICT DO NOTHING;

-- Pedidos ainda aguardando pagamento dentro do prazo.
INSERT INTO public.notificacao (user_id, tipo, titulo, mensagem, link, reserva_id, chave, criada_em)
SELECT p.cliente_id,
       'aguardando_pagamento',
       'Reserva aceita — aguardando pagamento',
       format('O gestor aceitou %s para %s. Pague até %s para garantir a data.',
              public.notificacao_item_nome(p.reserva_id),
              to_char(r.data_reserva, 'DD/MM/YYYY'),
              to_char(p.expira_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')),
       '/reservas/' || p.reserva_id || '/pagar',
       p.reserva_id,
       'pedido:' || p.id || ':aguardando_pagamento',
       p.criado_em
FROM public.pedido p
JOIN public.reserva r ON r.id = p.reserva_id
WHERE p.status = 'aguardando_pagamento'
  AND p.expira_em > now()
ON CONFLICT DO NOTHING;
