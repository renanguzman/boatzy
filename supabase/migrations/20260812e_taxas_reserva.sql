-- ============================================================
-- TAXAS: alinha o dado e liga a reserva na taxa dinâmica
-- ============================================================
-- `taxa_plataforma`, `usuario_taxa` e `get_taxa_usuario()` já existem
-- desde a migration 004_taxas_plataforma.sql, mas nunca foram lidas
-- pelo app — a reserva sempre usou 12% hardcoded no código, enquanto
-- o singleton no banco ficou parado em 10% (seed original).
--
-- Esta migration:
-- 1. Alinha o singleton em 12% — o valor real já cobrado hoje — antes
--    do app passar a ler dali, para não mudar preço de ninguém.
-- 2. Adiciona `reserva.taxa_percent`: snapshot da % efetivamente
--    aplicada no momento da solicitação (mesmo padrão de `preco_base`
--    e `taxa_servico`, já documentados em SPEC §20.1).
-- ============================================================

UPDATE public.taxa_plataforma
SET taxa_percent = 12.00, updated_at = now()
WHERE singleton = true;

ALTER TABLE public.reserva
  ADD COLUMN IF NOT EXISTS taxa_percent numeric(5, 2);
