-- ============================================================
-- PAGAMENTOS — FASE 1.2 (parte 2 de 2): reserva com pagamento
--
-- Aplicar DEPOIS da 20260930c (que cria os status novos).
--
-- 1) Colunas novas em `reserva`:
--    pagamento_exigido → true quando o aceite gerou um pedido (fluxo com
--                        pagamento). Reservas antigas / aceitas com a
--                        cobrança desligada ficam false.
--    aceita_em         → quando o gestor aceitou.
--    expirada_em       → quando o prazo de pagamento acabou.
--
-- 2) Bloqueio de data: a reserva aguardando pagamento SEGURA a data (senão
--    duas solicitações da mesma data poderiam ser aceitas ao mesmo tempo).
--    Os índices únicos parciais da migration 20260721 passam a valer para
--    'confirmada' E 'aguardando_pagamento' (renomeados de *_confirmada_uniq
--    para *_ocupada_uniq). Mesmas colunas de antes.
--
-- 3) financeiro_config.exigir_pagamento → chave geral: desligada, o aceite
--    do gestor volta a confirmar direto (sem pedido/cobrança).
-- ============================================================

ALTER TABLE public.reserva
  ADD COLUMN IF NOT EXISTS pagamento_exigido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aceita_em         timestamptz,
  ADD COLUMN IF NOT EXISTS expirada_em       timestamptz;

DROP INDEX IF EXISTS public.reserva_embarcacao_data_confirmada_uniq;
DROP INDEX IF EXISTS public.reserva_roteiro_data_confirmada_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS reserva_embarcacao_data_ocupada_uniq
  ON public.reserva (embarcacao_id, data_reserva)
  WHERE status IN ('confirmada', 'aguardando_pagamento') AND embarcacao_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reserva_roteiro_data_ocupada_uniq
  ON public.reserva (roteiro_id, data_reserva)
  WHERE status IN ('confirmada', 'aguardando_pagamento') AND roteiro_id IS NOT NULL;

ALTER TABLE public.financeiro_config
  ADD COLUMN IF NOT EXISTS exigir_pagamento boolean NOT NULL DEFAULT true;
