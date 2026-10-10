-- Migration: 20261010b_drop_embarcacao_suites
-- Remove a coluna suites da tabela embarcacao (campo unificado em quartos).

ALTER TABLE public.embarcacao DROP COLUMN IF EXISTS suites;
