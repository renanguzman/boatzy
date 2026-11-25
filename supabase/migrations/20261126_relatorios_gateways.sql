-- ============================================================
-- Relatórios com os dois gateways (26/11/2026) — SPEC §109.
--
-- O demonstrativo por gestor somava só as contas do Asaas (1.1.01 caixa e
-- 3.1.01 tarifa). Com o cartão na Stone/Pagar.me (20261125_pagarme_cartao.sql)
-- os recebimentos de cartão caem em 1.1.03 (caixa) e 3.1.03 (tarifa/MDR).
-- "bruto" = caixa + tarifa de qualquer gateway (= valor cobrado, com juros).
-- ============================================================

CREATE OR REPLACE FUNCTION public.demonstrativo_gestores(p_de date, p_ate date, p_base text DEFAULT 'competencia')
RETURNS TABLE (
  gestor_id uuid, pedidos bigint, bruto numeric, tarifa numeric, desconto numeric,
  comissao numeric, devido numeric, repassado numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lt.gestor_id,
         count(DISTINCT lt.pedido_id) FILTER (WHERE lt.tipo = 'recebimento'),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.natureza = 'D' AND l.conta_codigo IN ('1.1.01', '3.1.01', '1.1.03', '3.1.03')), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo IN ('3.1.01', '3.1.03')), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo = '3.1.02'), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo = '4.1.01'), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.tipo = 'recebimento' AND l.conta_codigo = '2.1.01' AND l.natureza = 'C'), 0),
         COALESCE(sum(l.valor) FILTER (WHERE lt.repasse_id IS NOT NULL AND l.conta_codigo = '2.1.01' AND l.natureza = 'D'), 0)
         - COALESCE(sum(l.valor) FILTER (WHERE lt.repasse_id IS NOT NULL AND l.conta_codigo = '2.1.01' AND l.natureza = 'C'), 0)
    FROM lancamento_lote lt
    JOIN lancamento_financeiro l ON l.lote_id = lt.id
   WHERE lt.gestor_id IS NOT NULL
     AND (CASE WHEN p_base = 'caixa' THEN lt.data_caixa ELSE lt.data_competencia END) BETWEEN p_de AND p_ate
   GROUP BY lt.gestor_id;
$$;

REVOKE ALL ON FUNCTION public.demonstrativo_gestores(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demonstrativo_gestores(date, date, text) TO service_role;
