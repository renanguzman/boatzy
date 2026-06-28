-- ============================================================
-- CHAT EM TEMPO REAL (Gestor ↔ Cliente)
-- Conversa 1:1 entre um gestor (owner) e um cliente, com troca
-- de mensagens de texto em tempo real (Supabase Realtime).
--
-- A conversa é simétrica: ambos os lados (painel do gestor e,
-- numa fase seguinte, o site do cliente) usam as mesmas tabelas.
-- `users.id == auth.users.id == auth.uid()` desde a migração
-- 20260517_clerk_to_supabase_auth, então a RLS usa auth.uid()
-- direto.
-- ============================================================

-- ── Tabela: conversa ─────────────────────────────────────────

CREATE TABLE public.conversa (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cliente_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gestor_id, cliente_id)
);

-- ── Tabela: mensagem ─────────────────────────────────────────

CREATE TABLE public.mensagem (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id  uuid        NOT NULL REFERENCES public.conversa(id) ON DELETE CASCADE,
  remetente_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conteudo     text        NOT NULL CHECK (char_length(conteudo) BETWEEN 1 AND 4000),
  lida_em      timestamptz,  -- null = não lida; preenchida quando o destinatário lê
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────

CREATE INDEX conversa_gestor_idx   ON public.conversa (gestor_id);
CREATE INDEX conversa_cliente_idx  ON public.conversa (cliente_id);
CREATE INDEX mensagem_conversa_idx ON public.mensagem (conversa_id, created_at);
CREATE INDEX mensagem_nao_lidas_idx ON public.mensagem (conversa_id) WHERE lida_em IS NULL;

-- ── Trigger: bump conversa.updated_at a cada nova mensagem ────

CREATE OR REPLACE FUNCTION bump_conversa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversa SET updated_at = now() WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mensagem_bump_conversa
  AFTER INSERT ON public.mensagem
  FOR EACH ROW EXECUTE FUNCTION bump_conversa_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagem ENABLE ROW LEVEL SECURITY;

-- conversa
CREATE POLICY "service_role_all" ON public.conversa
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "participante_select" ON public.conversa
  FOR SELECT TO authenticated
  USING (gestor_id = auth.uid() OR cliente_id = auth.uid());

CREATE POLICY "participante_insert" ON public.conversa
  FOR INSERT TO authenticated
  WITH CHECK (gestor_id = auth.uid() OR cliente_id = auth.uid());

-- mensagem
CREATE POLICY "service_role_all" ON public.mensagem
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "participante_select" ON public.mensagem
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversa c
      WHERE c.id = conversa_id
        AND (c.gestor_id = auth.uid() OR c.cliente_id = auth.uid())
    )
  );

CREATE POLICY "remetente_insert" ON public.mensagem
  FOR INSERT TO authenticated
  WITH CHECK (
    remetente_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversa c
      WHERE c.id = conversa_id
        AND (c.gestor_id = auth.uid() OR c.cliente_id = auth.uid())
    )
  );

-- destinatário marca como lida (atualiza lida_em)
CREATE POLICY "participante_update" ON public.mensagem
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversa c
      WHERE c.id = conversa_id
        AND (c.gestor_id = auth.uid() OR c.cliente_id = auth.uid())
    )
  );

-- ============================================================
-- Realtime: publica a tabela mensagem (entrega filtrada pela RLS
-- de SELECT acima — cada usuário só recebe as conversas das quais
-- participa).
-- ============================================================

ALTER TABLE public.mensagem REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagem;

-- ============================================================
-- RPCs de contagem de não lidas (usadas pelo painel do gestor)
-- security definer + param default auth.uid() para funcionar tanto
-- via service role (servidor, passa p_gestor) quanto via anon
-- (browser, usa auth.uid()).
-- ============================================================

CREATE OR REPLACE FUNCTION public.chat_nao_lidas_por_cliente(p_gestor uuid DEFAULT auth.uid())
RETURNS TABLE (cliente_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.cliente_id, count(m.id)
  FROM public.conversa c
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.gestor_id = p_gestor
    AND m.remetente_id = c.cliente_id
    AND m.lida_em IS NULL
  GROUP BY c.cliente_id;
$$;

CREATE OR REPLACE FUNCTION public.chat_total_nao_lidas(p_gestor uuid DEFAULT auth.uid())
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(m.id)
  FROM public.conversa c
  JOIN public.mensagem m ON m.conversa_id = c.id
  WHERE c.gestor_id = p_gestor
    AND m.remetente_id = c.cliente_id
    AND m.lida_em IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.chat_nao_lidas_por_cliente(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chat_total_nao_lidas(uuid)       TO authenticated, service_role;
