-- Migration: 009_embarcacao_modalidade_capitao
-- Adiciona modalidade de capitão à tabela embarcacao.

CREATE TYPE modalidade_capitao AS ENUM (
  'com_capitao',   -- capitão obrigatório incluso
  'sem_capitao',   -- bare charter: locatário pilota
  'opcional'       -- locatário escolhe levar ou não
);

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS modalidade_capitao modalidade_capitao NOT NULL DEFAULT 'com_capitao';
