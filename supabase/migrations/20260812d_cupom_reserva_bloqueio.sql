-- ============================================================
-- APLICAÇÃO DE CUPOM NA RESERVA + PROTEÇÃO CONTRA FORÇA BRUTA
--
-- Fecha o ciclo iniciado em 20260812c_cupons.sql: agora o cupom
-- pode ser efetivamente aplicado no momento da solicitação de
-- reserva (/reservas/novo). Duas peças:
--
-- 1. `reserva` ganha o snapshot do cupom usado (mesmo espírito dos
--    demais valores de `reserva`, gravados como snapshot — ver
--    021_reservas_roteiro.sql).
-- 2. `cupom_tentativa` + `registrar_tentativa_cupom`: rate limit de
--    tentativas de aplicar cupom, por cliente — 5 tentativas
--    malsucedidas seguidas bloqueiam por 15 minutos.
--
-- `registrar_uso_cupom` é a trava atômica final (SELECT ... FOR
-- UPDATE no cupom) que impede corrida no limite de uso entre a
-- pré-visualização e o envio da reserva.
--
-- Estendo via ALTER em vez de editar 021_reservas_roteiro.sql —
-- mesma prática já usada em 023_reserva_item_nome.sql.
-- ============================================================

ALTER TABLE public.reserva
  ADD COLUMN cupom_id       uuid REFERENCES public.cupom(id) ON DELETE SET NULL,
  ADD COLUMN cupom_codigo   text,
  ADD COLUMN desconto_valor numeric(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX reserva_cupom_idx ON public.reserva (cupom_id);

-- ── Tabela: cupom_tentativa (rate limit por cliente) ────────────

CREATE TABLE public.cupom_tentativa (
  cliente_id    uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tentativas    integer     NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cupom_tentativa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.cupom_tentativa
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- FUNÇÃO: registrar_tentativa_cupom
--
-- Atômica (SELECT ... FOR UPDATE) para não deixar corrida driblar
-- o contador. Chamada uma vez a cada tentativa de aplicar cupom
-- (sucesso ou falha), tanto na pré-visualização quanto no envio
-- final da reserva.
--
-- Enquanto já bloqueado (bloqueado_ate no futuro), não mexe nos
-- contadores — só informa o horário de liberação.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_tentativa_cupom(
  p_cliente_id uuid,
  p_sucesso    boolean
)
RETURNS TABLE (bloqueado boolean, bloqueado_ate timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tentativas    integer;
  v_bloqueado_ate timestamptz;
BEGIN
  INSERT INTO public.cupom_tentativa (cliente_id)
  VALUES (p_cliente_id)
  ON CONFLICT (cliente_id) DO NOTHING;

  SELECT ct.tentativas, ct.bloqueado_ate
    INTO v_tentativas, v_bloqueado_ate
  FROM public.cupom_tentativa ct
  WHERE ct.cliente_id = p_cliente_id
  FOR UPDATE;

  IF v_bloqueado_ate IS NOT NULL AND v_bloqueado_ate > now() THEN
    RETURN QUERY SELECT true, v_bloqueado_ate;
    RETURN;
  END IF;

  IF p_sucesso THEN
    UPDATE public.cupom_tentativa
    SET tentativas = 0, bloqueado_ate = NULL, atualizado_em = now()
    WHERE cliente_id = p_cliente_id;

    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;

  v_tentativas := v_tentativas + 1;

  IF v_tentativas >= 5 THEN
    v_bloqueado_ate := now() + interval '15 minutes';
    UPDATE public.cupom_tentativa
    SET tentativas = 0, bloqueado_ate = v_bloqueado_ate, atualizado_em = now()
    WHERE cliente_id = p_cliente_id;

    RETURN QUERY SELECT true, v_bloqueado_ate;
  ELSE
    UPDATE public.cupom_tentativa
    SET tentativas = v_tentativas, bloqueado_ate = NULL, atualizado_em = now()
    WHERE cliente_id = p_cliente_id;

    RETURN QUERY SELECT false, NULL::timestamptz;
  END IF;
END;
$$;

-- ============================================================
-- FUNÇÃO: registrar_uso_cupom
--
-- Trava final contra corrida no limite de uso: dá lock na linha do
-- cupom e RE-CHECA ativo/vigência/limites antes de gravar o uso —
-- mesmo que a pré-visualização tenha aprovado, algo pode ter mudado
-- (outro cliente esgotou o limite, admin pausou o cupom) entre a
-- pré-visualização e o envio da reserva.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_uso_cupom(
  p_cupom_id       uuid,
  p_cliente_id     uuid,
  p_reserva_id     uuid,
  p_valor_desconto numeric
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_cupom        public.cupom%ROWTYPE;
  v_usos_total   integer;
  v_usos_cliente integer;
BEGIN
  SELECT * INTO v_cupom FROM public.cupom WHERE id = p_cupom_id FOR UPDATE;

  IF NOT FOUND OR NOT v_cupom.ativo THEN
    RETURN false;
  END IF;

  IF v_cupom.data_inicio IS NOT NULL AND v_cupom.data_inicio > CURRENT_DATE THEN
    RETURN false;
  END IF;

  IF v_cupom.data_fim IS NOT NULL AND v_cupom.data_fim < CURRENT_DATE THEN
    RETURN false;
  END IF;

  IF v_cupom.limite_uso_total IS NOT NULL THEN
    SELECT count(*) INTO v_usos_total FROM public.cupom_uso WHERE cupom_id = p_cupom_id;
    IF v_usos_total >= v_cupom.limite_uso_total THEN
      RETURN false;
    END IF;
  END IF;

  IF v_cupom.limite_uso_por_cliente IS NOT NULL THEN
    SELECT count(*) INTO v_usos_cliente
    FROM public.cupom_uso
    WHERE cupom_id = p_cupom_id AND cliente_id = p_cliente_id;
    IF v_usos_cliente >= v_cupom.limite_uso_por_cliente THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO public.cupom_uso (cupom_id, reserva_id, cliente_id, valor_desconto)
  VALUES (p_cupom_id, p_reserva_id, p_cliente_id, p_valor_desconto);

  RETURN true;
END;
$$;

-- Só service_role executa — o fluxo inteiro passa por supabaseAdmin
-- nos server actions, nunca é chamada direto do navegador.
GRANT EXECUTE ON FUNCTION public.registrar_tentativa_cupom(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_uso_cupom(uuid, uuid, uuid, numeric) TO service_role;

-- A assinatura de funções novas aparece — força o PostgREST a reler o schema.
NOTIFY pgrst, 'reload schema';
