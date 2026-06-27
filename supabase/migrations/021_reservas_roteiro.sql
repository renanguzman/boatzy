-- ============================================================
-- RESERVAS DE ROTEIRO
-- Solicitação de reserva feita pelo cliente (site) sobre um
-- roteiro. Nasce como 'pendente' e o gestor (owner do roteiro)
-- pode confirmá-la ou recusá-la pelo painel, com observação
-- retornada ao cliente.
--
-- Os valores (preço, total, adicionais) são gravados como
-- SNAPSHOT no momento da solicitação — preservam o histórico
-- mesmo que o roteiro ou o catálogo mudem depois.
-- ============================================================

CREATE TYPE reserva_status AS ENUM ('pendente', 'confirmada', 'recusada');

-- ── Tabela: reserva ──────────────────────────────────────────

CREATE TABLE public.reserva (
  id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id         uuid           NOT NULL REFERENCES public.roteiro(id) ON DELETE CASCADE,
  embarcacao_id      uuid           REFERENCES public.embarcacao(id) ON DELETE SET NULL,
  cliente_id         uuid           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  owner_id           uuid           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- dados da solicitação
  data_reserva       date           NOT NULL,
  flexibilidade      smallint,
  quantidade_pessoas integer        NOT NULL,

  -- snapshot de valores no momento da solicitação
  roteiro_nome       text           NOT NULL,
  preco_base         numeric(12, 2),
  total_adicionais   numeric(12, 2) NOT NULL DEFAULT 0,
  taxa_servico       numeric(12, 2),
  total_estimado     numeric(12, 2),

  -- status / resposta do gestor
  status             reserva_status NOT NULL DEFAULT 'pendente',
  observacao_gestor  text,
  solicitado_em      timestamptz    NOT NULL DEFAULT now(),
  respondido_em      timestamptz,

  created_at         timestamptz    NOT NULL DEFAULT now(),
  updated_at         timestamptz    NOT NULL DEFAULT now()
);

-- ── Tabela: reserva_adicional (snapshot dos itens do catálogo) ─

CREATE TABLE public.reserva_adicional (
  id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id          uuid           NOT NULL REFERENCES public.reserva(id) ON DELETE CASCADE,
  roteiro_catalogo_id uuid           REFERENCES public.roteiro_catalogo(id) ON DELETE SET NULL,
  descricao           text           NOT NULL,
  valor               numeric(12, 2) NOT NULL,
  tipo                catalogo_tipo  NOT NULL,
  created_at          timestamptz    NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────

CREATE INDEX reserva_owner_status_idx     ON public.reserva (owner_id, status);
CREATE INDEX reserva_cliente_idx          ON public.reserva (cliente_id);
CREATE INDEX reserva_roteiro_idx          ON public.reserva (roteiro_id);
CREATE INDEX reserva_adicional_reserva_idx ON public.reserva_adicional (reserva_id);

-- ── Trigger updated_at ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_reserva_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reserva_updated_at_trigger
  BEFORE UPDATE ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION update_reserva_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.reserva           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_adicional ENABLE ROW LEVEL SECURITY;

-- reserva
CREATE POLICY "service_role_all" ON public.reserva
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- cliente vê e cria as próprias reservas
CREATE POLICY "cliente_select_own" ON public.reserva
  FOR SELECT TO authenticated USING (cliente_id = auth.uid());

CREATE POLICY "cliente_insert_own" ON public.reserva
  FOR INSERT TO authenticated WITH CHECK (cliente_id = auth.uid());

-- gestor (owner do roteiro) vê e atualiza (confirma/recusa)
CREATE POLICY "owner_select_own" ON public.reserva
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "owner_update_own" ON public.reserva
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- reserva_adicional
CREATE POLICY "service_role_all" ON public.reserva_adicional
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "participantes_select" ON public.reserva_adicional
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reserva r
      WHERE r.id = reserva_id
        AND (r.cliente_id = auth.uid() OR r.owner_id = auth.uid())
    )
  );
