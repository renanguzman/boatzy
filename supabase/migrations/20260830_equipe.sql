-- ============================================================
-- EQUIPE — funcionários que ajudam o gestor a cuidar da(s)
-- embarcação(ões) e que podem ser indicados para atender uma
-- reserva confirmada.
--
-- Estruturas:
--   equipe_membro             → a pessoa (pertence a um gestor)
--   equipe_membro_embarcacao  → vínculo N:N membro ↔ embarcação
--   reserva_atendente         → quem vai atender a reserva
--
-- A linha `is_gestor = true` representa o PRÓPRIO gestor como
-- atendente (ele pode se colocar para atender). É criada sob
-- demanda pelo app (ensureGestorEquipeMembro) e nunca é editada
-- nem excluída pelas telas normais. Assim `reserva_atendente`
-- guarda sempre um único FK (`equipe_membro_id`) e o relatório
-- futuro de atendimentos por membro fica uniforme.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Tabela: equipe_membro
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.equipe_membro (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Vínculo opcional com uma conta da plataforma. Não concede
  -- acesso a nada — é apenas identidade/rastreabilidade. O papel
  -- de `gestor` continua vindo de user_roles.
  user_id        uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  -- Linha do próprio gestor (opção "Você (gestor)" na confirmação).
  is_gestor      boolean     NOT NULL DEFAULT false,
  nome_completo  text        NOT NULL,
  -- Obrigatórios no formulário de cadastro de membro; NULL no banco
  -- para a linha do gestor, que herda o que houver em `users`.
  cpf            text,
  email          text,
  telefone       text,
  foto_url       text,
  ativo          boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX equipe_membro_owner_idx ON public.equipe_membro (owner_id);
CREATE INDEX equipe_membro_user_idx  ON public.equipe_membro (user_id);

-- CPF único por gestor (ignora linhas sem CPF, ex.: a do gestor).
CREATE UNIQUE INDEX equipe_membro_owner_cpf_uniq
  ON public.equipe_membro (owner_id, cpf)
  WHERE cpf IS NOT NULL;

-- No máximo uma linha "is_gestor" por gestor.
CREATE UNIQUE INDEX equipe_membro_owner_gestor_uniq
  ON public.equipe_membro (owner_id)
  WHERE is_gestor;

-- ─────────────────────────────────────────────────────────────
-- Tabela: equipe_membro_embarcacao (vínculo N:N)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.equipe_membro_embarcacao (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_membro_id uuid        NOT NULL REFERENCES public.equipe_membro(id) ON DELETE CASCADE,
  embarcacao_id    uuid        NOT NULL REFERENCES public.embarcacao(id)    ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipe_membro_id, embarcacao_id)
);

CREATE INDEX equipe_membro_embarcacao_membro_idx     ON public.equipe_membro_embarcacao (equipe_membro_id);
CREATE INDEX equipe_membro_embarcacao_embarcacao_idx ON public.equipe_membro_embarcacao (embarcacao_id);

-- ─────────────────────────────────────────────────────────────
-- Tabela: reserva_atendente
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.reserva_atendente (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id       uuid        NOT NULL REFERENCES public.reserva(id)       ON DELETE CASCADE,
  equipe_membro_id uuid        NOT NULL REFERENCES public.equipe_membro(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reserva_id, equipe_membro_id)
);

CREATE INDEX reserva_atendente_reserva_idx ON public.reserva_atendente (reserva_id);
CREATE INDEX reserva_atendente_membro_idx  ON public.reserva_atendente (equipe_membro_id);

-- ─────────────────────────────────────────────────────────────
-- Trigger updated_at (mesmo padrão das demais tabelas)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_equipe_membro_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipe_membro_updated_at_trigger
  BEFORE UPDATE ON public.equipe_membro
  FOR EACH ROW EXECUTE FUNCTION update_equipe_membro_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.equipe_membro            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membro_embarcacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_atendente        ENABLE ROW LEVEL SECURITY;

-- ── equipe_membro ──────────────────────────────────────────
CREATE POLICY "service_role_all" ON public.equipe_membro
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- O gestor gerencia os próprios membros.
CREATE POLICY "owner_select_own" ON public.equipe_membro
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "owner_insert_own" ON public.equipe_membro
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update_own" ON public.equipe_membro
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete_own" ON public.equipe_membro
  FOR DELETE TO authenticated USING (owner_id = auth.uid() AND is_gestor = false);

-- O cliente vê os membros indicados nas SUAS reservas (nome/foto/telefone).
CREATE POLICY "cliente_select_atendente" ON public.equipe_membro
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.reserva_atendente ra
      JOIN public.reserva r ON r.id = ra.reserva_id
      WHERE ra.equipe_membro_id = public.equipe_membro.id
        AND r.cliente_id = auth.uid()
    )
  );

-- ── equipe_membro_embarcacao ───────────────────────────────
CREATE POLICY "service_role_all" ON public.equipe_membro_embarcacao
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "owner_all_own" ON public.equipe_membro_embarcacao
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.equipe_membro m
      WHERE m.id = equipe_membro_id AND m.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.equipe_membro m
      WHERE m.id = equipe_membro_id AND m.owner_id = auth.uid()
    )
  );

-- ── reserva_atendente ──────────────────────────────────────
CREATE POLICY "service_role_all" ON public.reserva_atendente
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gestor (dono da reserva) gerencia; cliente (dono da reserva) só lê.
CREATE POLICY "owner_all_own" ON public.reserva_atendente
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reserva r
      WHERE r.id = reserva_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reserva r
      WHERE r.id = reserva_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "cliente_select_own" ON public.reserva_atendente
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reserva r
      WHERE r.id = reserva_id AND r.cliente_id = auth.uid()
    )
  );
