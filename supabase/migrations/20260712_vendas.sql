-- ============================================================
-- MÓDULO DE VENDAS — fundação de dados (Fase 1).
-- O gestor anuncia embarcações já cadastradas para VENDA; o site
-- ganha a busca "Vendas" e o painel ganha o funil de leads.
-- Plano completo: docs/planejamento-vendas.md.
--
--   • anuncio_venda           — um anúncio vigente por embarcação;
--     só os campos de venda (fabricante, anos, preço, status,
--     contador de visualizações). Dados técnicos/fotos/categoria/
--     localização vêm da embarcacao vinculada (fonte única).
--   • anuncio_venda_preco     — histórico de preço; alimenta o selo
--     público "Preço reduzido" (vigente < imediatamente anterior).
--     A escrita roda na server action junto com o INSERT/UPDATE do
--     anúncio (sem trigger, por decisão de escopo).
--   • anuncio_venda_interacao — eventos por usuário LOGADO
--     (visualizou, revelou_contato, favoritou, compartilhou,
--     conversou); fonte do funil. O estágio do lead é DERIVADO dos
--     eventos (RPC vendas_funil), nunca persistido. Visualização
--     anônima conta só no contador anuncio_venda.visualizacoes.
--   • favorito                — ganha o alvo anuncio_venda_id
--     (mesmo padrão da 20260709_favoritos_embarcacao).
--
-- Escrita do gestor roda nas server actions (supabaseAdmin, valida
-- sessão + posse); a RLS é uma segunda camada, como no restante.
-- Validações relacionais dos anos (modelo × fabricação) ficam no
-- form/server action; o banco garante apenas faixas sãs.
-- ============================================================

CREATE TYPE anuncio_venda_status AS ENUM ('ativo', 'pausado', 'vendido', 'cancelado');

CREATE TYPE anuncio_interacao_tipo AS ENUM (
  'visualizou', 'revelou_contato', 'favoritou', 'compartilhou', 'conversou'
);

-- ------------------------------------------------------------
-- anuncio_venda
-- ------------------------------------------------------------

CREATE TABLE public.anuncio_venda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id   uuid NOT NULL REFERENCES public.embarcacao(id) ON DELETE CASCADE,
  -- Denormalizado da embarcação para RLS/funil sem join extra.
  owner_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fabricante      text NOT NULL,
  ano_modelo      integer NOT NULL CHECK (ano_modelo BETWEEN 1900 AND 2100),
  ano_fabricacao  integer NOT NULL CHECK (ano_fabricacao BETWEEN 1900 AND 2100),
  preco           numeric(12,2) NOT NULL CHECK (preco > 0),
  descricao_venda text,
  status          anuncio_venda_status NOT NULL DEFAULT 'ativo',
  visualizacoes   bigint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Um anúncio VIGENTE (ativo/pausado) por embarcação; 'vendido' e
-- 'cancelado' encerram o ciclo e liberam a embarcação para um
-- novo anúncio.
CREATE UNIQUE INDEX anuncio_venda_embarcacao_vigente_uniq
  ON public.anuncio_venda (embarcacao_id)
  WHERE status IN ('ativo', 'pausado');

CREATE INDEX anuncio_venda_owner_idx      ON public.anuncio_venda (owner_id);
CREATE INDEX anuncio_venda_status_idx     ON public.anuncio_venda (status);
CREATE INDEX anuncio_venda_preco_idx      ON public.anuncio_venda (preco);
CREATE INDEX anuncio_venda_ano_modelo_idx ON public.anuncio_venda (ano_modelo);

CREATE OR REPLACE FUNCTION update_anuncio_venda_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER anuncio_venda_updated_at_trigger
  BEFORE UPDATE ON public.anuncio_venda
  FOR EACH ROW EXECUTE FUNCTION update_anuncio_venda_updated_at();

ALTER TABLE public.anuncio_venda ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON public.anuncio_venda
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Público vê apenas anúncio ativo de embarcação ativa (embarcação
-- desativada some do site, mesma regra da busca — SPEC §15-C).
CREATE POLICY publico_select_ativo ON public.anuncio_venda
  FOR SELECT TO anon, authenticated
  USING (
    status = 'ativo'
    AND EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.status = 'ativo'
    )
  );

-- O dono enxerga os próprios anúncios em qualquer status.
CREATE POLICY owner_select ON public.anuncio_venda
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- Só é possível anunciar embarcação própria.
CREATE POLICY owner_insert ON public.anuncio_venda
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = embarcacao_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY owner_update ON public.anuncio_venda
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Sem DELETE: o ciclo de vida é status (pausado/vendido/cancelado),
-- preservando histórico de preço e leads do funil.

-- ------------------------------------------------------------
-- anuncio_venda_preco (histórico de preço)
-- ------------------------------------------------------------

CREATE TABLE public.anuncio_venda_preco (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.anuncio_venda(id) ON DELETE CASCADE,
  preco      numeric(12,2) NOT NULL CHECK (preco > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX anuncio_venda_preco_anuncio_idx
  ON public.anuncio_venda_preco (anuncio_id, created_at DESC);

ALTER TABLE public.anuncio_venda_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON public.anuncio_venda_preco
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Leitura pública apenas de anúncios publicamente visíveis (o selo
-- "Preço reduzido" precisa do preço anterior); o dono lê sempre.
CREATE POLICY publico_select ON public.anuncio_venda_preco
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.anuncio_venda a
      JOIN public.embarcacao e ON e.id = a.embarcacao_id
      WHERE a.id = anuncio_id
        AND (
          (a.status = 'ativo' AND e.status = 'ativo')
          OR a.owner_id = auth.uid()
        )
    )
  );

CREATE POLICY owner_insert ON public.anuncio_venda_preco
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anuncio_venda a
      WHERE a.id = anuncio_id AND a.owner_id = auth.uid()
    )
  );

-- Sem UPDATE/DELETE: histórico é imutável (append-only).

-- ------------------------------------------------------------
-- anuncio_venda_interacao (eventos do funil)
-- ------------------------------------------------------------

CREATE TABLE public.anuncio_venda_interacao (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.anuncio_venda(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo       anuncio_interacao_tipo NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Um evento de cada tipo por lead↔anúncio: registro idempotente
  -- (desfavoritar NÃO remove o evento — o funil mede interesse
  -- demonstrado, não estado atual).
  UNIQUE (anuncio_id, user_id, tipo)
);

CREATE INDEX anuncio_venda_interacao_anuncio_idx
  ON public.anuncio_venda_interacao (anuncio_id, tipo);
CREATE INDEX anuncio_venda_interacao_user_idx
  ON public.anuncio_venda_interacao (user_id);

ALTER TABLE public.anuncio_venda_interacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON public.anuncio_venda_interacao
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- O usuário registra as próprias interações, apenas em anúncios
-- publicamente visíveis (nada de lead em anúncio pausado/vendido).
CREATE POLICY proprio_insert ON public.anuncio_venda_interacao
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.anuncio_venda a
      JOIN public.embarcacao e ON e.id = a.embarcacao_id
      WHERE a.id = anuncio_id
        AND a.status = 'ativo'
        AND e.status = 'ativo'
    )
  );

-- Lê: o próprio usuário (suas interações) e o dono do anúncio (funil).
CREATE POLICY participantes_select ON public.anuncio_venda_interacao
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.anuncio_venda a
      WHERE a.id = anuncio_id AND a.owner_id = auth.uid()
    )
  );

-- Sem UPDATE/DELETE: eventos são imutáveis (append-only).

-- ------------------------------------------------------------
-- favorito: novo alvo anuncio_venda_id
-- ------------------------------------------------------------

ALTER TABLE public.favorito
  ADD COLUMN anuncio_venda_id uuid REFERENCES public.anuncio_venda(id) ON DELETE CASCADE;

-- Exatamente um alvo por favorito (roteiro OU embarcação OU anúncio).
ALTER TABLE public.favorito
  DROP CONSTRAINT favorito_um_alvo_check;

ALTER TABLE public.favorito
  ADD CONSTRAINT favorito_um_alvo_check
  CHECK (num_nonnulls(roteiro_id, embarcacao_id, anuncio_venda_id) = 1);

-- Um favorito por par usuário↔anúncio.
CREATE UNIQUE INDEX favorito_user_anuncio_venda_uniq
  ON public.favorito (user_id, anuncio_venda_id)
  WHERE anuncio_venda_id IS NOT NULL;

CREATE INDEX favorito_anuncio_venda_idx
  ON public.favorito (anuncio_venda_id)
  WHERE anuncio_venda_id IS NOT NULL;
