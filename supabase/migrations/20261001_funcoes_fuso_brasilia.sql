-- ============================================================
-- FUSO HORÁRIO — funções que decidem por "hoje" (CURRENT_DATE)
--
-- O Postgres do Supabase roda em UTC: entre 21h e meia-noite (horário de
-- Brasília) o CURRENT_DATE já é o dia seguinte. Com isso:
--   • get_taxa_usuario  → a taxa específica de um gestor com validade "até
--                          hoje" deixava de valer às 21h;
--   • registrar_uso_cupom → um cupom com data_fim "hoje" era recusado a
--                          partir das 21h (e um com data_inicio "amanhã"
--                          já era aceito).
--
-- Correção sem reescrever as funções: fixar o fuso de execução DELAS em
-- America/Sao_Paulo — CURRENT_DATE (e qualquer conversão de data) passa a
-- ser a data de Brasília só dentro da função; o resto do banco segue em UTC.
-- Idempotente.
-- ============================================================

ALTER FUNCTION public.get_taxa_usuario(uuid) SET timezone = 'America/Sao_Paulo';

ALTER FUNCTION public.registrar_uso_cupom(uuid, uuid, uuid, numeric) SET timezone = 'America/Sao_Paulo';
