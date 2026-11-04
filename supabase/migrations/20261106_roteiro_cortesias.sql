-- Cortesias do passeio (04/11/2026)
--
-- Itens que o gestor oferece de cortesia no passeio (ex.: "Água potável", "5kg de gelo", "Carvão"),
-- cadastrados na etapa Informações do roteiro e exibidos no detalhe do roteiro, entre as
-- especificações e os opcionais ("Turbine seu passeio"). Lista ordenada de textos curtos; o app
-- normaliza (trim, sem vazias/duplicadas, até 20 itens de até 120 caracteres).
--
-- Coluna nova em tabela existente: não precisa de GRANT (a tabela já tem os da Data API).

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS cortesias text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.roteiro
  DROP CONSTRAINT IF EXISTS roteiro_cortesias_limite;
ALTER TABLE public.roteiro
  ADD CONSTRAINT roteiro_cortesias_limite CHECK (cardinality(cortesias) <= 20);

COMMENT ON COLUMN public.roteiro.cortesias IS
  'Cortesias oferecidas pelo passeio, na ordem de exibição (até 20). Campo sensível da publicação.';

-- ─── Publicação: cortesias passam a ser campo sensível ───────────────────────
-- Texto livre e público escrito pelo gestor (como a descrição). Mesmo critério das regras da
-- embarcação: a chave `cortesias` só entra no snapshot quando há cortesias, para não marcar como
-- alterados os roteiros aprovados antes desta migration. Remover TODAS não reenvia para análise.
-- Mesma definição de 20261025_embarcacao_regras.sql, com a chave `cortesias` no ramo do roteiro.

CREATE OR REPLACE FUNCTION public.publicacao_snapshot(p_entidade text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_entidade = 'embarcacao' THEN
    SELECT jsonb_build_object(
      'nome', btrim(e.nome),
      'descricao', NULLIF(btrim(e.descricao), ''),
      'embarcacao_tipo_id', e.embarcacao_tipo_id,
      'modalidade_capitao', e.modalidade_capitao,
      'capacidade', e.capacidade,
      'comprimento', e.comprimento,
      'comprimento_unidade', e.comprimento_unidade,
      'quartos', e.quartos,
      'banheiros', e.banheiros,
      'tripulacao', e.tripulacao,
      'localizacao', jsonb_build_object(
        'municipio_id', e.municipio_id, 'latitude', e.latitude, 'longitude', e.longitude,
        'cep', NULLIF(regexp_replace(COALESCE(e.cep, ''), '\D', '', 'g'), ''),
        'bairro', NULLIF(btrim(e.bairro), ''), 'logradouro', NULLIF(btrim(e.logradouro), ''),
        'logradouro_numero', NULLIF(btrim(e.logradouro_numero), ''),
        'complemento', NULLIF(btrim(e.complemento), '')),
      'fotos', COALESCE((
        SELECT jsonb_agg(i.url_imagem ORDER BY i.url_imagem)
        FROM public.embarcacao_imagens i WHERE i.embarcacao_id = e.id), '[]'::jsonb)
    )
    || CASE WHEN cardinality(e.regras) > 0
         THEN jsonb_build_object('regras', to_jsonb(e.regras))
         ELSE '{}'::jsonb
       END
    INTO v
    FROM public.embarcacao e WHERE e.id = p_id;

  ELSIF p_entidade = 'roteiro' THEN
    SELECT jsonb_build_object(
      'nome', btrim(r.nome),
      'descricao', NULLIF(btrim(r.descricao), ''),
      'origem', NULLIF(btrim(r.origem), ''),
      'destino', NULLIF(btrim(r.destino), ''),
      'embarcacao_id', r.embarcacao_id,
      'duracao_horas', r.duracao_horas,
      'paradas', COALESCE((
        SELECT jsonb_agg(btrim(p.nome) ORDER BY p.ordem)
        FROM public.roteiro_parada p WHERE p.roteiro_id = r.id), '[]'::jsonb),
      'fotos', COALESCE((
        SELECT jsonb_agg(i.url_imagem ORDER BY i.url_imagem)
        FROM public.roteiro_imagens i WHERE i.roteiro_id = r.id), '[]'::jsonb)
    )
    || CASE WHEN cardinality(r.cortesias) > 0
         THEN jsonb_build_object('cortesias', to_jsonb(r.cortesias))
         ELSE '{}'::jsonb
       END
    INTO v
    FROM public.roteiro r WHERE r.id = p_id;

  ELSIF p_entidade = 'anuncio_venda' THEN
    SELECT jsonb_build_object(
      'fabricante', btrim(a.fabricante),
      'ano_modelo', a.ano_modelo,
      'ano_fabricacao', a.ano_fabricacao,
      'descricao_venda', NULLIF(btrim(a.descricao_venda), '')
    ) INTO v
    FROM public.anuncio_venda a WHERE a.id = p_id;

  ELSE
    RAISE EXCEPTION 'entidade_invalida: %', p_entidade;
  END IF;

  RETURN v;
END;
$$;

-- CREATE OR REPLACE mantém os privilégios; reafirmados para ficar explícito.
REVOKE ALL ON FUNCTION public.publicacao_snapshot(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publicacao_snapshot(text, uuid) TO service_role;
