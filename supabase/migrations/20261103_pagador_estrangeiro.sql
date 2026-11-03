-- ============================================================
-- Pagador estrangeiro (03/11/2026) — SPEC §100.
--
-- Turista sem CPF paga com cartão internacional. O Asaas não tem campo para
-- passaporte (`cpfCnpj` só aceita CPF/CNPJ), então o customer vai para lá com
-- `foreignCustomer: true` e SEM documento; o documento oficial informado pelo
-- cliente (passaporte, DNI, RUT, cédula… qualquer documento oficial) fica só
-- no Boatzy, para comprovante, gestor e admin.
--
--   users.documento_estrangeiro   documento normalizado (A–Z, 0–9, 4–20)
--   users.pais_documento          país emissor (ISO 3166-1 alfa-2)
--   pagamento_tomador.pais        preenchido quando o "próprio" cliente pagou
--                                 como estrangeiro; `documento` guarda o
--                                 documento estrangeiro em vez de CPF/CNPJ
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN documento_estrangeiro text,
  ADD COLUMN pais_documento        text,
  ADD CONSTRAINT users_documento_estrangeiro_valido CHECK (
    documento_estrangeiro IS NULL
    OR (documento_estrangeiro ~ '^[A-Z0-9]{4,20}$' AND pais_documento ~ '^[A-Z]{2}$')
  );

COMMENT ON COLUMN public.users.documento_estrangeiro IS
  'Documento oficial de quem não tem CPF (passaporte, DNI, RUT…), normalizado — SPEC §100.';

ALTER TABLE public.pagamento_tomador
  ADD COLUMN pais text,
  ADD CONSTRAINT pagamento_tomador_pais_valido CHECK (pais IS NULL OR pais ~ '^[A-Z]{2}$');

-- `documento` continua NOT NULL; para o estrangeiro (tipo 'proprio' + país) aceita o documento alfanumérico.
ALTER TABLE public.pagamento_tomador DROP CONSTRAINT pagamento_tomador_documento_valido;
ALTER TABLE public.pagamento_tomador ADD CONSTRAINT pagamento_tomador_documento_valido CHECK (
  documento ~ '^([0-9]{11}|[0-9]{14})$'
  OR (tipo = 'proprio' AND pais IS NOT NULL AND documento ~ '^[A-Z0-9]{4,20}$')
);

COMMENT ON COLUMN public.pagamento_tomador.pais IS
  'País do documento quando o próprio cliente pagou como estrangeiro (sem CPF) — SPEC §100.';
