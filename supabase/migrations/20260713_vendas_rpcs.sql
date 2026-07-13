-- ============================================================
-- MÓDULO DE VENDAS — RPCs (Fase 1).
-- Depende de 20260712_vendas.sql. Plano: docs/planejamento-vendas.md.
--
--   • buscar_anuncios_venda        — busca pública paginada (/vendas).
--     Mesmo padrão de buscar_roteiros: retorna ids + total; a página
--     compõe os detalhes via select/embed.
--   • registrar_visualizacao_anuncio — contador de cliques/aberturas
--     do detalhe (anônimo ou logado). SECURITY DEFINER porque
--     anon/authenticated não têm UPDATE em anuncio_venda.
--   • vendas_locais                — estados/cidades COM anúncio ativo,
--     para os selects de localidade (só oferta o que existe, mesma
--     filosofia do autocomplete de /api/buscar/locais).
--   • vendas_funil                 — leads agregados por anúncio do
--     gestor, com estágio DERIVADO do evento mais quente. SECURITY
--     DEFINER (a RLS de users impede o browser de ler nome/avatar de
--     terceiros — mesmo motivo de chat_conversas_nao_lidas), com
--     guarda extra p_gestor = auth.uid() (service role: auth.uid()
--     nulo) para impedir consulta do funil alheio.
-- ============================================================

-- ------------------------------------------------------------
-- buscar_anuncios_venda
-- Filtros: categoria (da embarcação), estado/município (do endereço
-- da embarcação), faixa de ano do MODELO e faixa de preço. Todos
-- opcionais na RPC (a UI torna categoria obrigatória). Embarcação
-- sem município cadastrado não aparece quando há filtro de
-- localidade. Ordenação: mais recentes primeiro.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.buscar_anuncios_venda(
  p_categoria_id uuid    DEFAULT NULL,
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
      AND (p_categoria_id IS NULL OR e.embarcacao_categoria_id = p_categoria_id)
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

-- Busca pública (anônima) do hotsite.
GRANT EXECUTE ON FUNCTION public.buscar_anuncios_venda(
  uuid, integer, integer, integer, integer, numeric, numeric, integer, integer
) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- registrar_visualizacao_anuncio
-- Incrementa o contador de visualizações do detalhe (/vendas/[id]).
-- Conta anônimo e logado; só anúncio publicamente visível.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registrar_visualizacao_anuncio(p_anuncio uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.anuncio_venda a
  SET visualizacoes = a.visualizacoes + 1
  WHERE a.id = p_anuncio
    AND a.status = 'ativo'
    AND EXISTS (
      SELECT 1 FROM public.embarcacao e
      WHERE e.id = a.embarcacao_id AND e.status = 'ativo'
    );
$$;

GRANT EXECUTE ON FUNCTION public.registrar_visualizacao_anuncio(uuid)
  TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- vendas_locais
-- Municípios (com o estado) que possuem anúncio ativo, com a
-- contagem. O client agrupa por estado para montar os dois selects
-- (Estado → Cidades daquele estado).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendas_locais()
RETURNS TABLE (
  estado_id      integer,
  estado_nome    text,
  uf             text,
  municipio_id   integer,
  municipio_nome text,
  total          bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id        AS estado_id,
    s.nome      AS estado_nome,
    s.uf::text  AS uf,
    m.id        AS municipio_id,
    m.nome      AS municipio_nome,
    COUNT(a.id) AS total
  FROM public.anuncio_venda a
  JOIN public.embarcacao e ON e.id = a.embarcacao_id AND e.status = 'ativo'
  JOIN public.municipios m ON m.id = e.municipio_id
  JOIN public.estados    s ON s.id = m.estado_id
  WHERE a.status = 'ativo'
  GROUP BY s.id, s.nome, s.uf, m.id, m.nome
  ORDER BY s.nome, m.nome;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_locais()
  TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- vendas_funil
-- Um lead por par anúncio↔usuário, com o conjunto de eventos, o
-- estágio derivado do evento mais quente e a última interação:
--   1 visualizou · 2 revelou_contato · 3 favoritou ·
--   4 compartilhou · 5 conversou
-- (a "temperatura" fica só aqui — reordenar estágios não exige
-- migração de dados).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendas_funil(p_gestor uuid DEFAULT auth.uid())
RETURNS TABLE (
  anuncio_id        uuid,
  embarcacao_nome   text,
  user_id           uuid,
  lead_nome         text,
  lead_avatar       text,
  eventos           text[],
  estagio           integer,
  ultima_interacao  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id       AS anuncio_id,
    e.nome     AS embarcacao_nome,
    i.user_id,
    u.name     AS lead_nome,
    u.avatar_url AS lead_avatar,
    array_agg(DISTINCT i.tipo::text) AS eventos,
    MAX(
      CASE i.tipo
        WHEN 'visualizou'      THEN 1
        WHEN 'revelou_contato' THEN 2
        WHEN 'favoritou'       THEN 3
        WHEN 'compartilhou'    THEN 4
        WHEN 'conversou'       THEN 5
      END
    ) AS estagio,
    MAX(i.created_at) AS ultima_interacao
  FROM public.anuncio_venda_interacao i
  JOIN public.anuncio_venda a ON a.id = i.anuncio_id
  JOIN public.embarcacao    e ON e.id = a.embarcacao_id
  JOIN public.users         u ON u.id = i.user_id
  WHERE a.owner_id = p_gestor
    -- Guarda anti-spoof: gestor só consulta o próprio funil;
    -- service role (auth.uid() nulo) passa qualquer p_gestor.
    AND (p_gestor = auth.uid() OR auth.uid() IS NULL)
  GROUP BY a.id, e.nome, i.user_id, u.name, u.avatar_url
  ORDER BY MAX(i.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_funil(uuid)
  TO authenticated, service_role;
