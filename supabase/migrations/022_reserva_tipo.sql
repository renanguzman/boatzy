-- ============================================================
-- TIPO DA RESERVA (roteiro | embarcacao)
-- Permite diferenciar, no painel/calendário, reservas de roteiro
-- das reservas diretas de embarcação. Reservas existentes são de
-- roteiro (default 'roteiro'). A criação de reservas de embarcação
-- é um passo futuro — a coluna já deixa o modelo preparado.
-- ============================================================

CREATE TYPE reserva_tipo AS ENUM ('roteiro', 'embarcacao');

ALTER TABLE public.reserva
  ADD COLUMN IF NOT EXISTS tipo reserva_tipo NOT NULL DEFAULT 'roteiro';

-- roteiro_id passa a ser opcional: numa reserva de embarcação não há roteiro.
ALTER TABLE public.reserva
  ALTER COLUMN roteiro_id DROP NOT NULL;

-- Coerência: reserva de roteiro exige roteiro_id; reserva de embarcação exige embarcacao_id.
ALTER TABLE public.reserva
  ADD CONSTRAINT reserva_tipo_alvo_chk CHECK (
    (tipo = 'roteiro'    AND roteiro_id    IS NOT NULL) OR
    (tipo = 'embarcacao' AND embarcacao_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS reserva_owner_data_idx ON public.reserva (owner_id, data_reserva);
