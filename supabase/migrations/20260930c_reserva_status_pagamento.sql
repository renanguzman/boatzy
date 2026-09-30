-- ============================================================
-- PAGAMENTOS — FASE 1.2 (parte 1 de 2): novos status da reserva
--
--   aguardando_pagamento → o gestor aceitou; o cliente tem até
--                          pedido.expira_em para pagar. SEGURA a data.
--   expirada             → o prazo de pagamento acabou sem pagamento;
--                          a data volta a ficar livre.
--
-- ATENÇÃO: aplicar esta migration SOZINHA, antes da 20260930d. O Postgres
-- não deixa usar um valor novo de enum na mesma transação em que ele foi
-- criado (e o SQL Editor do Supabase roda o script inteiro numa transação).
-- ============================================================

ALTER TYPE public.reserva_status ADD VALUE IF NOT EXISTS 'aguardando_pagamento';
ALTER TYPE public.reserva_status ADD VALUE IF NOT EXISTS 'expirada';
