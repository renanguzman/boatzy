-- Tabela de vínculo entre roteiro e itens do catálogo
CREATE TABLE IF NOT EXISTS roteiro_catalogo (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id        UUID          NOT NULL REFERENCES roteiro(id) ON DELETE CASCADE,
  catalogo_id       UUID          NOT NULL REFERENCES catalogo(id) ON DELETE CASCADE,
  valor_customizado NUMERIC(12,2) NULL,  -- NULL = usa o valor padrão do catálogo
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (roteiro_id, catalogo_id)
);

CREATE INDEX roteiro_catalogo_roteiro_id_idx ON roteiro_catalogo(roteiro_id);

ALTER TABLE roteiro_catalogo ENABLE ROW LEVEL SECURITY;

-- Mesmo owner do roteiro pode gerenciar os vínculos
CREATE POLICY "roteiro_catalogo_select" ON roteiro_catalogo
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roteiro r
      WHERE r.id = roteiro_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "roteiro_catalogo_insert" ON roteiro_catalogo
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM roteiro r
      WHERE r.id = roteiro_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "roteiro_catalogo_delete" ON roteiro_catalogo
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM roteiro r
      WHERE r.id = roteiro_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "roteiro_catalogo_update" ON roteiro_catalogo
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM roteiro r
      WHERE r.id = roteiro_id AND r.owner_id = auth.uid()
    )
  );
