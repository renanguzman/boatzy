-- Migration: 005_embarcacao_status
-- Adiciona coluna status à tabela embarcacao.

CREATE TYPE embarcacao_status AS ENUM ('ativo', 'inativo', 'em_manutencao');

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS status embarcacao_status NOT NULL DEFAULT 'ativo';

CREATE INDEX IF NOT EXISTS embarcacao_status_idx ON public.embarcacao (status);
