-- Enum para tipo de item do catálogo
CREATE TYPE catalogo_tipo AS ENUM ('produto', 'servico');

-- Tabela catálogo
CREATE TABLE IF NOT EXISTS catalogo (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao   TEXT              NOT NULL,
  valor       NUMERIC(12, 2)    NOT NULL,
  tipo        catalogo_tipo     NOT NULL,
  owner_id    UUID              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_boatzy   BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Índice para busca por owner
CREATE INDEX catalogo_owner_id_idx ON catalogo(owner_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_catalogo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalogo_updated_at_trigger
  BEFORE UPDATE ON catalogo
  FOR EACH ROW EXECUTE FUNCTION update_catalogo_updated_at();

-- RLS
ALTER TABLE catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_owner_select" ON catalogo
  FOR SELECT USING (auth.uid() = owner_id OR is_boatzy = TRUE);

CREATE POLICY "catalogo_owner_insert" ON catalogo
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "catalogo_owner_update" ON catalogo
  FOR UPDATE USING (auth.uid() = owner_id AND is_boatzy = FALSE);

CREATE POLICY "catalogo_owner_delete" ON catalogo
  FOR DELETE USING (auth.uid() = owner_id AND is_boatzy = FALSE);
