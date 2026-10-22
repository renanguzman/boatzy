-- ============================================================
-- SOLICITAÇÃO DE ACESSO DE GESTOR (dono de embarcação)
--
-- Regra de produto: qualquer conta pode PEDIR para ser gestor,
-- mas o papel `gestor` só é concedido quando a equipe Boatzy
-- (admin) aprova o pedido em /administrator/usuarios/solicitacoes.
-- Antes, /api/painel/setup-role concedia o papel a qualquer
-- usuário logado em um clique. Gestores existentes não mudam.
--
--   • solicitacao_gestor — um registro por pedido, com os dados
--     informados pelo solicitante e a decisão do admin.
--     No máximo um pedido `pendente` por usuário; um pedido
--     recusado pode ser refeito (novo registro).
--   • decidir_solicitacao_gestor() — ÚNICA porta de decisão:
--     trava o pedido, exige `pendente`, grava a decisão e, se
--     aprovado, insere o papel `gestor` em user_roles — tudo na
--     mesma transação.
--
-- Escrita roda nas server actions (supabaseAdmin); a RLS deixa o
-- solicitante apenas LER os próprios pedidos. Detalhes: SPEC §62.
-- ============================================================

CREATE TYPE public.solicitacao_gestor_status AS ENUM ('pendente', 'aprovada', 'recusada');

CREATE TABLE public.solicitacao_gestor (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status             public.solicitacao_gestor_status NOT NULL DEFAULT 'pendente',
  nome               text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 200),
  telefone           text NOT NULL CHECK (telefone ~ '^\+[0-9]{8,15}$'),
  documento          text NOT NULL CHECK (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  estado_id          integer NOT NULL REFERENCES public.estados(id),
  municipio_id       integer NOT NULL REFERENCES public.municipios(id),
  qtd_embarcacoes    smallint NOT NULL CHECK (qtd_embarcacoes BETWEEN 1 AND 999),
  mensagem           text CHECK (mensagem IS NULL OR length(mensagem) <= 1000),
  -- Decisão do admin: a observação ao solicitante vai no e-mail e na
  -- tela do painel; a interna só o admin vê.
  observacao         text CHECK (observacao IS NULL OR length(observacao) <= 1000),
  observacao_interna text CHECK (observacao_interna IS NULL OR length(observacao_interna) <= 1000),
  decidido_em        timestamptz,
  decidido_por       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'pendente') = (decidido_em IS NULL))
);

CREATE UNIQUE INDEX solicitacao_gestor_pendente_unica
  ON public.solicitacao_gestor (user_id) WHERE status = 'pendente';
CREATE INDEX solicitacao_gestor_status_idx
  ON public.solicitacao_gestor (status, created_at);
CREATE INDEX solicitacao_gestor_user_idx
  ON public.solicitacao_gestor (user_id, created_at DESC);

ALTER TABLE public.solicitacao_gestor ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacao_gestor TO anon, authenticated, service_role;

CREATE POLICY service_role_all ON public.solicitacao_gestor
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY user_select_own ON public.solicitacao_gestor
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- Decisão do admin (aprovar → concede o papel gestor)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decidir_solicitacao_gestor(
  p_id                 uuid,
  p_aprovar            boolean,
  p_admin_id           uuid,
  p_observacao         text DEFAULT NULL,
  p_observacao_interna text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid;
  v_status public.solicitacao_gestor_status;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'apenas_admin';
  END IF;

  SELECT user_id, status INTO v_user, v_status
    FROM solicitacao_gestor WHERE id = p_id FOR UPDATE;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'solicitacao_inexistente';
  END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'solicitacao_ja_decidida';
  END IF;
  IF NOT p_aprovar AND nullif(btrim(coalesce(p_observacao, '')), '') IS NULL THEN
    RAISE EXCEPTION 'observacao_obrigatoria';
  END IF;

  UPDATE solicitacao_gestor
     SET status             = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'recusada' END::solicitacao_gestor_status,
         observacao         = nullif(btrim(coalesce(p_observacao, '')), ''),
         observacao_interna = nullif(btrim(coalesce(p_observacao_interna, '')), ''),
         decidido_em        = now(),
         decidido_por       = p_admin_id,
         updated_at         = now()
   WHERE id = p_id;

  IF p_aprovar THEN
    INSERT INTO user_roles (user_id, role) VALUES (v_user, 'gestor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.decidir_solicitacao_gestor(uuid, boolean, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_solicitacao_gestor(uuid, boolean, uuid, text, text)
  TO service_role;
