-- ============================================================
-- MÓDULO DE VENDAS — busca por TIPO da embarcação (correção).
-- A busca de Vendas é por venda de EMBARCAÇÃO, então o filtro
-- primário obrigatório é o TIPO (Lancha, Iate, Jet Ski, …), não a
-- CATEGORIA (Passeio, Pesca, Luxo, …) — esta é orientada a passeio.
-- Substitui `buscar_anuncios_venda` (20260713) trocando
-- p_categoria_id/embarcacao_categoria_id por p_tipo_id/
-- embarcacao_tipo_id. Plano: docs/planejamento-vendas.md.
--
-- DROP + CREATE (e não CREATE OR REPLACE) porque o Postgres não
-- permite renomear parâmetro de entrada de uma função existente.
-- ============================================================

DROP FUNCTION IF EXISTS public.buscar_anuncios_venda(
  uuid, integer, integer, integer, integer, numeric, numeric, integer, integer
);

CREATE OR REPLACE FUNCTION public.buscar_anuncios_venda(
  p_tipo_id      uuid    DEFAULT NULL,
  p_estado_id    integer DEFAULT NULL,
  p_municipio_id integer DEFAULT NULL,
  p_ano_min      integer DEFAULT NULL,
  p_ano_max      integer DEFAULT NULL,
  p_preco_min    numeric DEFAULT NULL,
  p_preco_max    numeric DEFAULT NULL,
  p_limit        integer DEFAULT 24,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (id uuid, total bigint)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT a.id, a.created_at
    FROM public.anuncio_venda a
    JOIN public.embarcacao e ON e.id = a.embarcacao_id
    LEFT JOIN public.municipios m ON m.id = e.municipio_id
    WHERE a.status = 'ativo'
      AND e.status = 'ativo'
      AND (p_tipo_id     IS NULL OR e.embarcacao_tipo_id = p_tipo_id)
      AND (p_estado_id    IS NULL OR m.estado_id = p_estado_id)
      AND (p_municipio_id IS NULL OR e.municipio_id = p_municipio_id)
      AND (p_ano_min   IS NULL OR a.ano_modelo >= p_ano_min)
      AND (p_ano_max   IS NULL OR a.ano_modelo <= p_ano_max)
      AND (p_preco_min IS NULL OR a.preco >= p_preco_min)
      AND (p_preco_max IS NULL OR a.preco <= p_preco_max)
  )
  SELECT b.id, COUNT(*) OVER () AS total
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_anuncios_venda(
  uuid, integer, integer, integer, integer, numeric, numeric, integer, integer
) TO anon, authenticated, service_role;
