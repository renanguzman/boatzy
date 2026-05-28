-- Migration: 008_embarcacao_quartos_suites
-- Adiciona campos quartos e suites à tabela embarcacao.

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS quartos integer,
  ADD COLUMN IF NOT EXISTS suites integer;
