-- ============================================================
-- DOCUMENTAÇÃO NO ADMIN — filtro e contadores no banco (SPEC §95.9)
--
-- Antes, a lista /administrator/embarcacoes lia TODOS os documentos ativos,
-- montava a situação de cada embarcação em JS e mandava os ids no filtro
-- (`id=in.(…)`) — a URL crescia com a plataforma. Agora a situação é calculada
-- no Postgres:
--
--  • situacao_documentacao(embarcacao) → 'vencida' | 'nao_enviada' | 'em_dia'
--  • documentacao_vencendo(embarcacao) → algum documento vence em até 60 dias
--    Campos calculados do PostgREST: filtráveis direto na consulta da lista
--    (`?situacao_documentacao=eq.vencida`), junto com status, busca e paginação.
--  • contar_documentacao_embarcacoes(p_status) → os 4 contadores numa passada
--    (GROUP BY + LEFT JOIN), para os chips da lista e o dashboard.
--
-- Mesmas regras de src/lib/documentos/admin.ts e validade.ts:
--   vencida  = algum documento ativo da embarcação com validade < hoje;
--   em_dia   = tem documento de inscrição ativo (TIE, TIEM, PRPM) e nada vencido;
--   nao_enviada = o resto (inclui embarcação sem nenhum documento);
--   vencendo = validade entre hoje e hoje + 60 (DIAS_ALERTA).
-- "Hoje" é a data de Brasília, calculada explicitamente (sem `SET timezone` na
-- função, para o planner continuar podendo embutir as funções SQL na consulta).
--
-- Só o service_role executa (o admin consulta via supabaseAdmin). Idempotente.
-- ============================================================

-- Documentos ativos por embarcação — atende as três funções.
CREATE INDEX IF NOT EXISTS documento_embarcacao_ativos_idx
  ON public.documento (embarcacao_id, data_validade, tipo)
  WHERE arquivado_em IS NULL AND escopo = 'embarcacao';

CREATE OR REPLACE FUNCTION public.situacao_documentacao(e public.embarcacao)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN bool_or(d.data_validade < (now() AT TIME ZONE 'America/Sao_Paulo')::date) THEN 'vencida'
    WHEN bool_or(d.tipo IN ('tie', 'tiem', 'prpm')) THEN 'em_dia'
    ELSE 'nao_enviada'
  END
  FROM public.documento d
  WHERE d.embarcacao_id = e.id
    AND d.escopo = 'embarcacao'
    AND d.arquivado_em IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.documentacao_vencendo(e public.embarcacao)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documento d
    WHERE d.embarcacao_id = e.id
      AND d.escopo = 'embarcacao'
      AND d.arquivado_em IS NULL
      AND d.data_validade BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date
                              AND (now() AT TIME ZONE 'America/Sao_Paulo')::date + 60
  );
$$;

-- p_status NULL = todas as embarcações (aba "Todos" e dashboard).
CREATE OR REPLACE FUNCTION public.contar_documentacao_embarcacoes(p_status text DEFAULT NULL)
RETURNS TABLE (vencida bigint, nao_enviada bigint, em_dia bigint, vencendo bigint)
LANGUAGE sql STABLE
AS $$
  WITH hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  docs AS (
    SELECT d.embarcacao_id,
           bool_or(d.data_validade < hoje.d) AS tem_vencido,
           bool_or(d.tipo IN ('tie', 'tiem', 'prpm')) AS tem_inscricao,
           bool_or(d.data_validade BETWEEN hoje.d AND hoje.d + 60) AS tem_vencendo
    FROM public.documento d, hoje
    WHERE d.escopo = 'embarcacao' AND d.arquivado_em IS NULL
    GROUP BY d.embarcacao_id
  )
  SELECT
    count(*) FILTER (WHERE COALESCE(x.tem_vencido, false)),
    count(*) FILTER (WHERE NOT COALESCE(x.tem_vencido, false) AND NOT COALESCE(x.tem_inscricao, false)),
    count(*) FILTER (WHERE NOT COALESCE(x.tem_vencido, false) AND COALESCE(x.tem_inscricao, false)),
    count(*) FILTER (WHERE COALESCE(x.tem_vencendo, false))
  FROM public.embarcacao e
  LEFT JOIN docs x ON x.embarcacao_id = e.id
  WHERE p_status IS NULL OR e.status::text = p_status;
$$;

REVOKE EXECUTE ON FUNCTION public.situacao_documentacao(public.embarcacao) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documentacao_vencendo(public.embarcacao) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contar_documentacao_embarcacoes(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.situacao_documentacao(public.embarcacao) TO service_role;
GRANT EXECUTE ON FUNCTION public.documentacao_vencendo(public.embarcacao) TO service_role;
GRANT EXECUTE ON FUNCTION public.contar_documentacao_embarcacoes(text) TO service_role;

-- PostgREST passa a enxergar os campos calculados e a função nova.
NOTIFY pgrst, 'reload schema';
