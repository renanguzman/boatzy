-- ============================================================
-- BLOQUEIO DE DATA POR RESERVA CONFIRMADA (embarcação/roteiro)
-- O recurso escasso de verdade é a EMBARCAÇÃO, não o roteiro: uma
-- embarcação pode atender vários roteiros, e uma reserva CONFIRMADA
-- em qualquer um deles (ou uma reserva direta da embarcação) deve
-- bloquear a data nos demais. Só 'confirmada' bloqueia — 'pendente'
-- não bloqueia nada por design (várias pendentes podem coexistir
-- até o gestor decidir).
--
-- Dois índices únicos parciais como rede de segurança contra corrida
-- de concorrência (a checagem "amigável" roda antes, na aplicação —
-- ver src/lib/reservas.ts, criarReserva e responderReserva):
--
-- 1) Mesma EMBARCAÇÃO não pode ter 2 reservas confirmadas na mesma
--    data. Cobre roteiro×roteiro (mesma embarcação vinculada a dois
--    roteiros), roteiro×embarcação direta e embarcação direta×
--    embarcação direta, já que reserva.embarcacao_id é preenchido
--    nos três casos (ver migration 022).
-- 2) Mesmo ROTEIRO não pode ter 2 reservas confirmadas na mesma data,
--    COM ou SEM embarcação vinculada. Necessário mesmo quando o
--    roteiro tem embarcação: reserva.embarcacao_id é um snapshot do
--    momento da solicitação e pode ficar desatualizado se o gestor
--    trocar a embarcação vinculada do roteiro (EditarRoteiroForm)
--    depois de já existir uma reserva confirmada — nesse caso as duas
--    reservas cairiam em valores diferentes de embarcacao_id e o
--    índice (1) sozinho não as pegaria. Este índice fecha essa lacuna.
--
-- NULLs nunca colidem entre si em índice único do Postgres, então
-- múltiplas linhas com embarcacao_id/roteiro_id NULL não conflitam.
-- ============================================================

CREATE UNIQUE INDEX reserva_embarcacao_data_confirmada_uniq
  ON public.reserva (embarcacao_id, data_reserva)
  WHERE status = 'confirmada' AND embarcacao_id IS NOT NULL;

CREATE UNIQUE INDEX reserva_roteiro_data_confirmada_uniq
  ON public.reserva (roteiro_id, data_reserva)
  WHERE status = 'confirmada' AND roteiro_id IS NOT NULL;
