-- ============================================================
-- PIPELINE DE APROVAÇÃO — parte 1/2: valores de status.
--
-- Embarcação, roteiro e anúncio de venda passam a nascer
-- "Em análise" e só o admin publica (ver 20261013b).
--
--   • embarcacao_status vira publicacao_status (compartilhado por
--     embarcação e roteiro) e ganha em_analise e retorno.
--   • anuncio_venda_status ganha em_analise e retorno.
--
-- Fica em migration própria porque o Postgres não deixa usar um
-- valor novo de enum na mesma transação em que ele foi criado.
-- ============================================================

ALTER TYPE public.embarcacao_status RENAME TO publicacao_status;

ALTER TYPE public.publicacao_status ADD VALUE IF NOT EXISTS 'em_analise' BEFORE 'ativo';
ALTER TYPE public.publicacao_status ADD VALUE IF NOT EXISTS 'retorno' BEFORE 'ativo';

ALTER TYPE public.anuncio_venda_status ADD VALUE IF NOT EXISTS 'em_analise' BEFORE 'ativo';
ALTER TYPE public.anuncio_venda_status ADD VALUE IF NOT EXISTS 'retorno' BEFORE 'ativo';
