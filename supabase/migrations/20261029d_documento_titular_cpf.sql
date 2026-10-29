-- ============================================================
-- DOCUMENTOS — CPF do titular da habilitação (29/10/2026) — SPEC §95.1.
--
-- A CHA/CIR traz o CPF do condutor. Até aqui ele só era usado no navegador
-- para achar/cadastrar a pessoa na Equipe e depois descartado; agora fica
-- gravado no documento (somente dígitos, 11). Continua visível só para o
-- gestor dono (/painel) e para a administração — nunca no site público.
--
-- Também passam a ser gravados, em `dados` (jsonb, sem coluna nova):
--   limites_navegacao, orgao_emissor (habilitação).
-- E `categoria` aceita categorias combinadas separadas por vírgula
-- ("mestre,motonauta"), como está na carteira.
--
-- Só ALTER TABLE: os GRANTs da tabela `documento` (20261028_documentos.sql)
-- continuam valendo.
-- ============================================================

ALTER TABLE public.documento
  ADD COLUMN IF NOT EXISTS titular_cpf text
  CONSTRAINT documento_titular_cpf_valido CHECK (titular_cpf ~ '^[0-9]{11}$');

COMMENT ON COLUMN public.documento.titular_cpf IS
  'CPF do titular da habilitação (CHA/CIR), só dígitos. NULL nos documentos de embarcação.';

COMMENT ON COLUMN public.documento.categoria IS
  'Categorias da habilitação separadas por vírgula, na ordem arrais|mestre|capitao,motonauta,veleiro (ex.: mestre,motonauta).';
