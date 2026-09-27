-- ============================================================
-- REMOÇÃO DA CATEGORIA DE EMBARCAÇÃO
--
-- A categoria (Passeio, Pesca, Esporte, Luxo, Familiar) saiu do
-- produto: não é mais cadastrada, editada, listada nem exibida. O
-- único recurso que já a usou — o filtro da busca de Vendas — foi
-- migrado para o TIPO em 20260714_vendas_busca_por_tipo.sql, então
-- nenhuma função/RPC depende mais dela.
--
-- IRREVERSÍVEL: os valores gravados em embarcacao_categoria_id e o
-- conteúdo de embarcacao_categoria são descartados.
-- ============================================================

DROP INDEX IF EXISTS public.embarcacao_categoria_id_idx;

ALTER TABLE public.embarcacao
  DROP COLUMN IF EXISTS embarcacao_categoria_id;

DROP TABLE IF EXISTS public.embarcacao_categoria;
