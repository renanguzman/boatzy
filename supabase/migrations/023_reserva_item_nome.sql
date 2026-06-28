-- ============================================================
-- RENOMEIA reserva.roteiro_nome → reserva.item_nome
-- A coluna guarda o nome-snapshot do alvo da reserva, que pode
-- ser um roteiro OU uma embarcação. O nome neutro evita confusão.
-- ============================================================

ALTER TABLE public.reserva
  RENAME COLUMN roteiro_nome TO item_nome;
