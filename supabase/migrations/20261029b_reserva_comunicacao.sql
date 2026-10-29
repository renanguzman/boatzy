-- ============================================================
-- Comunicações da reserva + lembretes do passeio (28/10/2026) — SPEC §96.
--
-- reserva_comunicacao: linha do tempo de TUDO o que o sistema envia sobre
-- uma reserva, por canal (e-mail, aviso no sino, WhatsApp), para o cliente
-- e para o gestor. Visível ao cliente (/minhas-reservas/[id]), ao gestor
-- (/painel/agendamentos/[id]) e ao admin (/administrator/reservas/[id]).
--
-- Quem grava:
--   - avisos no sino: trigger AFTER INSERT em `notificacao` (abaixo) —
--     qualquer aviso com reserva_id vira um item (exceto mensagens de chat);
--   - e-mails: a aplicação (`enviarEmail(..., registro)` e o job de
--     lembretes `/api/cron/lembretes-passeio`), com o resultado do Resend;
--   - WhatsApp: ainda não há integração — os lembretes gravam o item como
--     `pendente_integracao` (só o admin vê).
--
-- Idempotência dos lembretes: `chave` única ('lembrete:<reserva>:<marco>:<papel>:<canal>').
-- O job "reserva" a chave (status `agendado`) antes de enviar — rodar duas
-- vezes não duplica; falha é tentada de novo até 3 vezes.
--
-- Histórico: não se apaga (trigger bloqueia DELETE/TRUNCATE); UPDATE só
-- muda o resultado do envio. A reserva apagada leva junto (CASCADE).
-- ============================================================

CREATE TABLE public.reserva_comunicacao (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id     uuid        NOT NULL REFERENCES public.reserva(id) ON DELETE CASCADE,
  tipo           text        NOT NULL,   -- lembrete_d1, lembrete_h3, reserva_confirmada, pagamento_aprovado…
  papel          text        NOT NULL,   -- destinatário
  canal          text        NOT NULL,
  status         text        NOT NULL DEFAULT 'enviado',
  destino        text,                   -- e-mail/telefone (mascarado na tela de cliente e gestor)
  assunto        text,                   -- assunto do e-mail / título do aviso
  resumo         text,
  erro           text,
  provedor_id    text,                   -- id do Resend
  tentativas     integer     NOT NULL DEFAULT 0,
  chave          text,
  notificacao_id uuid        REFERENCES public.notificacao(id) ON DELETE SET NULL,
  agendado_para  timestamptz,
  enviado_em     timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_comunicacao_tipo_formato CHECK (tipo ~ '^[a-z0-9_]{3,40}$'),
  CONSTRAINT reserva_comunicacao_papel_valido CHECK (papel IN ('cliente', 'gestor')),
  CONSTRAINT reserva_comunicacao_canal_valido CHECK (canal IN ('email', 'notificacao', 'whatsapp')),
  CONSTRAINT reserva_comunicacao_status_valido CHECK (status IN ('agendado', 'enviado', 'falhou', 'dispensado', 'pendente_integracao'))
);

-- Único total (NULLs não colidem): o upsert do supabase-js não informa predicado de índice parcial.
CREATE UNIQUE INDEX reserva_comunicacao_chave_uniq ON public.reserva_comunicacao (chave);
CREATE INDEX reserva_comunicacao_reserva_idx ON public.reserva_comunicacao (reserva_id, criado_em);

ALTER TABLE public.reserva_comunicacao ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reserva_comunicacao TO anon, authenticated, service_role;

CREATE POLICY service_role_all ON public.reserva_comunicacao
  TO service_role USING (true) WITH CHECK (true);

-- Leitura: cliente e gestor da reserva. Escrita só pelo servidor.
CREATE POLICY participante_select ON public.reserva_comunicacao
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reserva r
    WHERE r.id = reserva_comunicacao.reserva_id
      AND (r.cliente_id = auth.uid() OR r.owner_id = auth.uid())
  ));

CREATE OR REPLACE FUNCTION public.trg_reserva_comunicacao_protege()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.reserva_id IS DISTINCT FROM OLD.reserva_id OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.papel IS DISTINCT FROM OLD.papel OR NEW.canal IS DISTINCT FROM OLD.canal
       OR NEW.chave IS DISTINCT FROM OLD.chave OR NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
      RAISE EXCEPTION 'reserva_comunicacao: só o resultado do envio pode mudar';
    END IF;
    NEW.atualizado_em := now();
    RETURN NEW;
  END IF;
  -- Apagar a reserva leva o histórico junto (CASCADE); apagar só o histórico, não.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.reserva WHERE id = OLD.reserva_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'reserva_comunicacao é um histórico: não pode ser apagado';
END;
$$;

CREATE TRIGGER reserva_comunicacao_protege
  BEFORE UPDATE OR DELETE ON public.reserva_comunicacao
  FOR EACH ROW EXECUTE FUNCTION public.trg_reserva_comunicacao_protege();

CREATE TRIGGER reserva_comunicacao_sem_truncate
  BEFORE TRUNCATE ON public.reserva_comunicacao
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_reserva_comunicacao_protege();

-- ------------------------------------------------------------
-- Novo tipo de aviso: lembrete do passeio (cliente e gestor)
-- ------------------------------------------------------------
ALTER TABLE public.notificacao DROP CONSTRAINT notificacao_tipo_valido;
ALTER TABLE public.notificacao ADD CONSTRAINT notificacao_tipo_valido CHECK (tipo IN (
  'reserva_solicitada',
  'reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida',
  'aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso', 'mensagem',
  'documento_vencendo', 'cobranca_avulsa', 'lembrete_passeio'
));

-- ------------------------------------------------------------
-- Aviso no sino com reserva → item na linha do tempo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notificacao_comunicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reserva_id IS NULL OR NEW.tipo = 'mensagem' THEN RETURN NEW; END IF;
  INSERT INTO public.reserva_comunicacao
    (reserva_id, tipo, papel, canal, status, assunto, resumo, notificacao_id, enviado_em, criado_em, chave)
  VALUES
    (NEW.reserva_id, NEW.tipo, NEW.publico, 'notificacao', 'enviado', NEW.titulo, left(NEW.mensagem, 500),
     NEW.id, NEW.criada_em, NEW.criada_em, 'notificacao:' || NEW.id)
  ON CONFLICT (chave) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_notificacao_comunicacao() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notificacao_comunicacao
  AFTER INSERT ON public.notificacao
  FOR EACH ROW EXECUTE FUNCTION public.trg_notificacao_comunicacao();

-- Backfill: avisos já enviados entram na linha do tempo.
INSERT INTO public.reserva_comunicacao
  (reserva_id, tipo, papel, canal, status, assunto, resumo, notificacao_id, enviado_em, criado_em, chave)
SELECT n.reserva_id, n.tipo, n.publico, 'notificacao', 'enviado', n.titulo, left(n.mensagem, 500),
       n.id, n.criada_em, n.criada_em, 'notificacao:' || n.id
FROM public.notificacao n
WHERE n.reserva_id IS NOT NULL AND n.tipo <> 'mensagem'
ON CONFLICT (chave) DO NOTHING;
