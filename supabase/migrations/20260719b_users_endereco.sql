-- Migration: 20260719b_users_endereco
-- Endereço (opcional) do usuário, exibido/editado em "Minha conta".
--
-- Reaproveita as tabelas estados/municipios (mesma lógica do cadastro de
-- roteiro): estado e município são referências por id. Todos os campos são
-- NULLABLE — a seção "Meu endereço" é totalmente opcional.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS endereco_cep          text,
  ADD COLUMN IF NOT EXISTS endereco_estado_id    integer REFERENCES public.estados(id),
  ADD COLUMN IF NOT EXISTS endereco_municipio_id integer REFERENCES public.municipios(id),
  ADD COLUMN IF NOT EXISTS endereco_bairro       text,
  ADD COLUMN IF NOT EXISTS endereco_logradouro   text,
  ADD COLUMN IF NOT EXISTS endereco_numero       text,
  ADD COLUMN IF NOT EXISTS endereco_complemento  text;
