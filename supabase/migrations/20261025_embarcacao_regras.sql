-- Regras da embarcação (25/10/2026)
--
-- Regras de uso definidas pelo dono (ex.: "Proibido fumar a bordo"), cadastradas no step Detalhes
-- do painel e exibidas no detalhe do roteiro e na página da embarcação. Lista ordenada de textos
-- curtos; o app normaliza (trim, sem vazias/duplicadas, até 20 itens de até 120 caracteres).
--
-- Coluna nova em tabela existente: não precisa de GRANT (a tabela já tem os da Data API).

ALTER TABLE public.embarcacao
  ADD COLUMN IF NOT EXISTS regras text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.embarcacao
  DROP CONSTRAINT IF EXISTS embarcacao_regras_limite;
ALTER TABLE public.embarcacao
  ADD CONSTRAINT embarcacao_regras_limite CHECK (cardinality(regras) <= 20);

COMMENT ON COLUMN public.embarcacao.regras IS
  'Regras de uso definidas pelo dono, na ordem de exibição (até 20). Campo sensível da publicação.';

-- ─── Publicação: regras passam a ser campo sensível ──────────────────────────
-- Texto livre e público escrito pelo dono (como a descrição): incluir ou alterar regras de uma
-- embarcação aprovada a devolve para análise. A chave `regras` só entra no snapshot quando há
-- regras — `publicacao_campos_alterados` compara as chaves do snapshot ATUAL com o aprovado, e os
-- snapshots aprovados antes desta migration não têm a chave; com `regras: null`/`[]` sempre presente,
-- toda embarcação aprovada seria marcada como alterada na próxima edição. Efeito colateral aceito:
-- remover TODAS as regras não reenvia para análise (só tira conteúdo do site).
-- Mesma definição de 20261013b_publicacao_pipeline.sql, com a chave `regras` no ramo da embarcação.

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
    ) INTO v
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
