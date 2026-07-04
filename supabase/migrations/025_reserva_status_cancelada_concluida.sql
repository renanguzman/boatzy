-- ============================================================
-- Novos status de reserva:
--   'cancelada'  — cancelamento feito pelo CLIENTE (pendente ou
--                  confirmada); 'recusada' segue sendo a negativa
--                  do GESTOR.
--   'concluida'  — reserva confirmada cuja data já passou; é a
--                  porta de entrada para a avaliação do cliente
--                  (PRD §8: só avalia quem tem reserva concluída).
-- A transição para 'concluida' é automática/lazy: o helper
-- concluirReservasVencidas() (src/lib/reservas.ts) roda ao abrir
-- /minhas-reservas e /painel/agendamentos.
-- Obs.: valores novos de enum não podem ser USADOS na mesma
-- transação em que foram criados — esta migration apenas os cria.
-- ============================================================

ALTER TYPE public.reserva_status ADD VALUE IF NOT EXISTS 'cancelada';
ALTER TYPE public.reserva_status ADD VALUE IF NOT EXISTS 'concluida';

-- Quando o cliente cancelou (equivalente ao respondido_em do gestor).
ALTER TABLE public.reserva ADD COLUMN IF NOT EXISTS cancelada_em timestamptz;
