-- Migration: 010_embarcacao_coordenadas
-- Adiciona coordenadas geográficas à tabela embarcacao para exibição no mapa.

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS latitude  numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7);
