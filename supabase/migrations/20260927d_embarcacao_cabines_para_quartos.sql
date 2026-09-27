-- ============================================================
-- CABINES → QUARTOS
--
-- O campo "Cabines" saiu do cadastro de embarcação; "Quartos" passa a
-- ser o único e é o que o site mostra ao cliente (antes mostrava
-- Cabines, nunca Quartos). Antes de remover a coluna, o valor de
-- `cabines` é copiado para `quartos` nas embarcações em que `quartos`
-- ainda está vazio, para não perder a informação exibida hoje.
--
-- RODAR SÓ DEPOIS DO DEPLOY do código que parou de ler `cabines` —
-- a versão anterior do site ainda consulta a coluna.
-- ============================================================

UPDATE public.embarcacao
   SET quartos = cabines
 WHERE quartos IS NULL
   AND cabines IS NOT NULL;

ALTER TABLE public.embarcacao
  DROP COLUMN IF EXISTS cabines;
