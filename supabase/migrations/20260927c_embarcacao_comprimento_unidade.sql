-- ============================================================
-- UNIDADE DO COMPRIMENTO DA EMBARCAÇÃO (metros ou pés)
--
-- O gestor passa a escolher, no cadastro, se o comprimento está em
-- metros ('m') ou pés ('pes'). O valor em `comprimento` continua sendo
-- gravado exatamente como digitado — sem conversão — e a unidade vai
-- em `comprimento_unidade`. Registros existentes eram todos em metros,
-- daí o default 'm'.
-- ============================================================

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS comprimento_unidade text NOT NULL DEFAULT 'm';

ALTER TABLE public.embarcacao
  DROP CONSTRAINT IF EXISTS embarcacao_comprimento_unidade_check;

ALTER TABLE public.embarcacao
  ADD CONSTRAINT embarcacao_comprimento_unidade_check
  CHECK (comprimento_unidade IN ('m', 'pes'));
