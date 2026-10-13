-- ============================================================
-- PIPELINE DE APROVAÇÃO — parte 2/2 (embarcação, roteiro e
-- anúncio de venda). Depende de 20261013_publicacao_status_enum.
--
-- Regra de produto: o gestor cria e envia para análise; só o
-- admin publica (Em análise → Ativo) ou devolve (→ Retorno, com
-- observação). O gestor pode tirar do ar (Inativo / Em manutenção
-- / Pausado) e, para voltar, sempre passa de novo pela análise.
-- Editar campo sensível de um registro Ativo o devolve para
-- análise. Detalhes: PRD "Pipeline de aprovação" e SPEC §45.
--
--   • Colunas de controle nas 3 tabelas (status_alterado_em,
--     enviado_analise_em, aprovado_em/por, primeira_aprovacao_em,
--     revisao, snapshot_aprovado).
--   • roteiro.status (publicacao_status). roteiro.ativo continua
--     existindo, mas passa a ser DERIVADO por trigger: "visível no
--     site" = roteiro Ativo E embarcação vinculada Ativa. Assim as
--     RPCs de busca que filtram r.ativo seguem válidas sem reescrita
--     e o cascade manual da server action deixa de existir.
--   • publicacao_evento — timeline (log) de todas as mudanças.
--   • transicionar_publicacao() — ÚNICA porta de mudança de status:
--     valida a transição para o papel, atualiza e grava o evento.
--     Um trigger bloqueia qualquer UPDATE de status/controle feito
--     fora dela (fecha a brecha do owner_update via RLS).
--   • publicacao_verificar_edicao() — compara os campos sensíveis
--     com o snapshot da última aprovação e devolve para análise.
--   • Registros existentes mantêm o status (evento "migracao").
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colunas de controle
-- ------------------------------------------------------------

ALTER TABLE public.embarcacao
  ALTER COLUMN status SET DEFAULT 'em_analise',
  ADD COLUMN IF NOT EXISTS status_alterado_em    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS enviado_analise_em    timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_em           timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primeira_aprovacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisao               integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snapshot_aprovado     jsonb;

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS status                public.publicacao_status NOT NULL DEFAULT 'em_analise',
  ADD COLUMN IF NOT EXISTS status_alterado_em    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS enviado_analise_em    timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_em           timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primeira_aprovacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisao               integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snapshot_aprovado     jsonb;

ALTER TABLE public.anuncio_venda
  ALTER COLUMN status SET DEFAULT 'em_analise',
  ADD COLUMN IF NOT EXISTS status_alterado_em    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS enviado_analise_em    timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_em           timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primeira_aprovacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisao               integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snapshot_aprovado     jsonb;

CREATE INDEX IF NOT EXISTS roteiro_status_idx ON public.roteiro (status);
-- Fila de análise do admin: mais antigos primeiro.
CREATE INDEX IF NOT EXISTS embarcacao_fila_analise_idx
  ON public.embarcacao (enviado_analise_em) WHERE status = 'em_analise';
CREATE INDEX IF NOT EXISTS roteiro_fila_analise_idx
  ON public.roteiro (enviado_analise_em) WHERE status = 'em_analise';
CREATE INDEX IF NOT EXISTS anuncio_venda_fila_analise_idx
  ON public.anuncio_venda (enviado_analise_em) WHERE status = 'em_analise';

-- Anúncio em análise/retorno também é "vigente": continua valendo
-- um anúncio aberto por embarcação.
DROP INDEX IF EXISTS public.anuncio_venda_embarcacao_vigente_uniq;
CREATE UNIQUE INDEX anuncio_venda_embarcacao_vigente_uniq
  ON public.anuncio_venda (embarcacao_id)
  WHERE status IN ('em_analise', 'retorno', 'ativo', 'pausado');

-- ------------------------------------------------------------
-- 2. Timeline
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.publicacao_evento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarcacao_id      uuid REFERENCES public.embarcacao(id)    ON DELETE CASCADE,
  roteiro_id         uuid REFERENCES public.roteiro(id)       ON DELETE CASCADE,
  anuncio_venda_id   uuid REFERENCES public.anuncio_venda(id) ON DELETE CASCADE,
  -- Dono do registro no momento do evento (filtros do painel).
  owner_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo               text NOT NULL CHECK (tipo IN (
                       'criacao', 'envio_analise', 'reativacao', 'edicao_sensivel',
                       'aprovacao', 'retorno', 'moderacao',
                       'inativacao', 'manutencao', 'pausa', 'venda', 'cancelamento',
                       'migracao')),
  status_anterior    text,
  status_novo        text NOT NULL,
  -- Visível ao dono do registro.
  observacao         text,
  -- Só o admin vê. A tabela não tem policy para anon/authenticated:
  -- toda leitura passa pelo servidor, que escolhe as colunas.
  observacao_interna text,
  -- Campos sensíveis que mudaram desde a última aprovação.
  campos_alterados   text[],
  ator_id            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ator_papel         text NOT NULL CHECK (ator_papel IN ('gestor', 'admin', 'sistema')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(embarcacao_id, roteiro_id, anuncio_venda_id) = 1)
);

CREATE INDEX IF NOT EXISTS publicacao_evento_embarcacao_idx
  ON public.publicacao_evento (embarcacao_id, created_at) WHERE embarcacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS publicacao_evento_roteiro_idx
  ON public.publicacao_evento (roteiro_id, created_at) WHERE roteiro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS publicacao_evento_anuncio_idx
  ON public.publicacao_evento (anuncio_venda_id, created_at) WHERE anuncio_venda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS publicacao_evento_owner_idx
  ON public.publicacao_evento (owner_id, created_at DESC);

ALTER TABLE public.publicacao_evento ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publicacao_evento TO anon, authenticated, service_role;

DROP POLICY IF EXISTS service_role_all ON public.publicacao_evento;
CREATE POLICY service_role_all ON public.publicacao_evento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 3. Snapshot dos campos sensíveis
--    O que muda aqui exige nova aprovação. Preço, regras de preço,
--    disponibilidade, bloqueios, horários e itens de catálogo NÃO
--    entram (salvam direto). Fotos: conjunto de URLs (ordem e título
--    não contam). Textos normalizados como os formulários gravam
--    (trim, vazio = NULL, CEP só dígitos) para dado legado não
--    parecer "alterado" na primeira edição.
-- ------------------------------------------------------------

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
    ) INTO v
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

-- Campos sensíveis que diferem do snapshot da última aprovação.
-- NULL = nunca aprovado (não há base de comparação).
CREATE OR REPLACE FUNCTION public.publicacao_campos_alterados(p_entidade text, p_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_base  jsonb;
  v_atual jsonb;
BEGIN
  IF p_entidade NOT IN ('embarcacao', 'roteiro', 'anuncio_venda') THEN
    RAISE EXCEPTION 'entidade_invalida: %', p_entidade;
  END IF;

  EXECUTE format('SELECT snapshot_aprovado FROM public.%I WHERE id = $1', p_entidade)
    INTO v_base USING p_id;
  IF v_base IS NULL THEN RETURN NULL; END IF;

  v_atual := public.publicacao_snapshot(p_entidade, p_id);

  RETURN ARRAY(
    SELECT k FROM jsonb_object_keys(v_atual) AS k
    WHERE (v_atual -> k) IS DISTINCT FROM (v_base -> k)
    ORDER BY k
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. Transição de status (porta única)
-- ------------------------------------------------------------

-- Matriz de transições. Retorna o tipo do evento ou NULL (proibida).
-- Espelhada (só para a UI) em src/lib/publicacao/transicoes.ts.
CREATE OR REPLACE FUNCTION public.publicacao_tipo_transicao(
  p_entidade text, p_papel text, p_de text, p_para text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Embarcação e roteiro
    WHEN p_entidade IN ('embarcacao', 'roteiro') THEN
      CASE p_papel
        WHEN 'gestor' THEN CASE
          WHEN p_de = 'retorno' AND p_para = 'em_analise' THEN 'envio_analise'
          WHEN p_de IN ('inativo', 'em_manutencao') AND p_para = 'em_analise' THEN 'reativacao'
          WHEN p_de = 'ativo' AND p_para = 'em_analise' THEN 'edicao_sensivel'
          WHEN p_de IN ('em_analise', 'retorno', 'ativo', 'em_manutencao') AND p_para = 'inativo' THEN 'inativacao'
          WHEN p_de = 'ativo' AND p_para = 'em_manutencao' THEN 'manutencao'
        END
        WHEN 'admin' THEN CASE
          WHEN p_de = 'em_analise' AND p_para = 'ativo' THEN 'aprovacao'
          WHEN p_de = 'em_analise' AND p_para = 'retorno' THEN 'retorno'
          WHEN p_de IN ('em_analise', 'retorno', 'ativo', 'em_manutencao') AND p_para = 'inativo' THEN 'moderacao'
        END
      END
    -- Anúncio de venda
    WHEN p_entidade = 'anuncio_venda' THEN
      CASE p_papel
        WHEN 'gestor' THEN CASE
          WHEN p_de = 'retorno' AND p_para = 'em_analise' THEN 'envio_analise'
          WHEN p_de = 'pausado' AND p_para = 'em_analise' THEN 'reativacao'
          WHEN p_de = 'ativo' AND p_para = 'em_analise' THEN 'edicao_sensivel'
          WHEN p_de = 'ativo' AND p_para = 'pausado' THEN 'pausa'
          WHEN p_de IN ('ativo', 'pausado') AND p_para = 'vendido' THEN 'venda'
          WHEN p_de IN ('em_analise', 'retorno', 'ativo', 'pausado') AND p_para = 'cancelado' THEN 'cancelamento'
        END
        WHEN 'admin' THEN CASE
          WHEN p_de = 'em_analise' AND p_para = 'ativo' THEN 'aprovacao'
          WHEN p_de = 'em_analise' AND p_para = 'retorno' THEN 'retorno'
          WHEN p_de IN ('em_analise', 'retorno', 'ativo') AND p_para = 'pausado' THEN 'moderacao'
        END
      END
  END;
$$;

CREATE OR REPLACE FUNCTION public.transicionar_publicacao(
  p_entidade           text,
  p_id                 uuid,
  p_para               text,
  p_ator_id            uuid,
  p_ator_papel         text,
  p_observacao         text   DEFAULT NULL,
  p_observacao_interna text   DEFAULT NULL,
  p_campos             text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_de        text;
  v_owner     uuid;
  v_tipo      text;
  v_enum      text;
  v_obs       text := NULLIF(btrim(p_observacao), '');
  v_obs_int   text := NULLIF(btrim(p_observacao_interna), '');
  v_evento_id uuid;
BEGIN
  IF p_entidade NOT IN ('embarcacao', 'roteiro', 'anuncio_venda') THEN
    RAISE EXCEPTION 'entidade_invalida: %', p_entidade;
  END IF;
  IF p_ator_papel NOT IN ('gestor', 'admin') THEN
    RAISE EXCEPTION 'papel_invalido: %', p_ator_papel;
  END IF;
  v_enum := CASE WHEN p_entidade = 'anuncio_venda' THEN 'anuncio_venda_status' ELSE 'publicacao_status' END;

  -- Trava o registro: duas ações simultâneas não passam pela mesma origem.
  EXECUTE format('SELECT status::text, owner_id FROM public.%I WHERE id = $1 FOR UPDATE', p_entidade)
    INTO v_de, v_owner USING p_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'registro_nao_encontrado';
  END IF;
  IF p_ator_papel = 'gestor' AND p_ator_id IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  IF v_de = p_para THEN
    RAISE EXCEPTION 'status_inalterado';
  END IF;

  v_tipo := public.publicacao_tipo_transicao(p_entidade, p_ator_papel, v_de, p_para);
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'transicao_invalida: % -> % (%)', v_de, p_para, p_ator_papel;
  END IF;
  IF v_tipo IN ('retorno', 'moderacao') AND v_obs IS NULL THEN
    RAISE EXCEPTION 'observacao_obrigatoria';
  END IF;

  -- Libera o trigger de proteção só dentro desta transação.
  PERFORM set_config('boatzy.transicao_publicacao', 'on', true);

  EXECUTE format(
    'UPDATE public.%I SET
       status             = $1::public.%I,
       status_alterado_em = now(),
       enviado_analise_em = CASE WHEN $1 = ''em_analise'' THEN now() ELSE enviado_analise_em END,
       revisao            = CASE WHEN $1 = ''em_analise'' THEN revisao + 1 ELSE revisao END,
       aprovado_em        = CASE WHEN $2 = ''aprovacao'' THEN now() ELSE aprovado_em END,
       aprovado_por       = CASE WHEN $2 = ''aprovacao'' THEN $3 ELSE aprovado_por END,
       primeira_aprovacao_em = CASE WHEN $2 = ''aprovacao'' THEN COALESCE(primeira_aprovacao_em, now())
                                    ELSE primeira_aprovacao_em END
     WHERE id = $4',
    p_entidade, v_enum)
  USING p_para, v_tipo, p_ator_id, p_id;

  -- Na aprovação, o estado atual vira a base de comparação das próximas edições.
  IF v_tipo = 'aprovacao' THEN
    EXECUTE format('UPDATE public.%I SET snapshot_aprovado = $1 WHERE id = $2', p_entidade)
      USING public.publicacao_snapshot(p_entidade, p_id), p_id;
  END IF;

  PERFORM set_config('boatzy.transicao_publicacao', '', true);

  INSERT INTO public.publicacao_evento (
    embarcacao_id, roteiro_id, anuncio_venda_id, owner_id,
    tipo, status_anterior, status_novo,
    observacao, observacao_interna, campos_alterados,
    ator_id, ator_papel
  ) VALUES (
    CASE WHEN p_entidade = 'embarcacao'    THEN p_id END,
    CASE WHEN p_entidade = 'roteiro'       THEN p_id END,
    CASE WHEN p_entidade = 'anuncio_venda' THEN p_id END,
    v_owner,
    v_tipo, v_de, p_para,
    v_obs, CASE WHEN p_ator_papel = 'admin' THEN v_obs_int END, p_campos,
    p_ator_id, p_ator_papel
  )
  RETURNING id INTO v_evento_id;

  RETURN jsonb_build_object(
    'evento_id', v_evento_id, 'tipo', v_tipo,
    'status_anterior', v_de, 'status_novo', p_para
  );
END;
$$;

-- Chamada ao fim de toda ação que grava campo sensível. Gestor
-- editando registro Ativo → volta para análise (retorna os campos).
-- Admin editando registro Ativo → a edição já nasce aprovada
-- (atualiza o snapshot). Registro que já voltou para análise por
-- edição: as ações seguintes do mesmo salvamento (fotos, paradas…)
-- só atualizam a lista de campos do evento. Demais casos: NULL.
CREATE OR REPLACE FUNCTION public.publicacao_verificar_edicao(
  p_entidade   text,
  p_id         uuid,
  p_ator_id    uuid,
  p_ator_papel text
)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_campos text[];
BEGIN
  IF p_entidade NOT IN ('embarcacao', 'roteiro', 'anuncio_venda') THEN
    RAISE EXCEPTION 'entidade_invalida: %', p_entidade;
  END IF;

  EXECUTE format('SELECT status::text FROM public.%I WHERE id = $1 FOR UPDATE', p_entidade)
    INTO v_status USING p_id;

  IF v_status = 'em_analise' AND p_ator_papel = 'gestor' THEN
    EXECUTE format(
      'UPDATE public.publicacao_evento SET campos_alterados = $1
       WHERE id = (SELECT id FROM public.publicacao_evento WHERE %I = $2
                   ORDER BY created_at DESC, id DESC LIMIT 1)
         AND tipo = ''edicao_sensivel''',
      p_entidade || '_id')
    USING public.publicacao_campos_alterados(p_entidade, p_id), p_id;
    RETURN NULL;
  END IF;

  IF v_status IS DISTINCT FROM 'ativo' THEN RETURN NULL; END IF;

  v_campos := public.publicacao_campos_alterados(p_entidade, p_id);
  IF v_campos IS NULL OR cardinality(v_campos) = 0 THEN RETURN NULL; END IF;

  IF p_ator_papel = 'admin' THEN
    PERFORM set_config('boatzy.transicao_publicacao', 'on', true);
    EXECUTE format('UPDATE public.%I SET snapshot_aprovado = $1 WHERE id = $2', p_entidade)
      USING public.publicacao_snapshot(p_entidade, p_id), p_id;
    PERFORM set_config('boatzy.transicao_publicacao', '', true);
    RETURN NULL;
  END IF;

  PERFORM public.transicionar_publicacao(
    p_entidade, p_id, 'em_analise', p_ator_id, 'gestor', NULL, NULL, v_campos);
  RETURN v_campos;
END;
$$;

-- ------------------------------------------------------------
-- 5. Dados existentes (antes dos triggers de proteção)
-- ------------------------------------------------------------

-- Roteiro: ativo=false podia ser só o cascade da embarcação
-- desativada; nesse caso o roteiro em si continua "ativo" e
-- reaparece quando a embarcação voltar (mesmo comportamento do
-- cascade simétrico anterior).
UPDATE public.roteiro r
SET status = CASE
  WHEN r.ativo THEN 'ativo'::public.publicacao_status
  WHEN EXISTS (SELECT 1 FROM public.embarcacao e
               WHERE e.id = r.embarcacao_id AND e.status <> 'ativo') THEN 'ativo'::public.publicacao_status
  ELSE 'inativo'::public.publicacao_status
END;

-- Tudo o que já existia foi publicado em algum momento.
UPDATE public.embarcacao SET
  status_alterado_em    = COALESCE(updated_at, created_at),
  aprovado_em           = created_at,
  primeira_aprovacao_em = created_at,
  snapshot_aprovado     = public.publicacao_snapshot('embarcacao', id);

UPDATE public.roteiro SET
  status_alterado_em    = COALESCE(updated_at, created_at),
  aprovado_em           = created_at,
  primeira_aprovacao_em = created_at,
  snapshot_aprovado     = public.publicacao_snapshot('roteiro', id);

UPDATE public.anuncio_venda SET
  status_alterado_em    = updated_at,
  aprovado_em           = created_at,
  primeira_aprovacao_em = created_at,
  snapshot_aprovado     = public.publicacao_snapshot('anuncio_venda', id);

INSERT INTO public.publicacao_evento (embarcacao_id, owner_id, tipo, status_novo, ator_papel, created_at)
SELECT id, owner_id, 'migracao', status::text, 'sistema', now() FROM public.embarcacao;

INSERT INTO public.publicacao_evento (roteiro_id, owner_id, tipo, status_novo, ator_papel, created_at)
SELECT id, owner_id, 'migracao', status::text, 'sistema', now() FROM public.roteiro;

INSERT INTO public.publicacao_evento (anuncio_venda_id, owner_id, tipo, status_novo, ator_papel, created_at)
SELECT id, owner_id, 'migracao', status::text, 'sistema', now() FROM public.anuncio_venda;

-- ------------------------------------------------------------
-- 6. Triggers
-- ------------------------------------------------------------

-- 6a. INSERT: todo registro nasce Em análise (ignora o status
--     enviado) e ganha o evento "criacao".
CREATE OR REPLACE FUNCTION public.publicacao_trg_antes_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.status                := 'em_analise';
  NEW.status_alterado_em    := now();
  NEW.enviado_analise_em    := now();
  NEW.revisao               := 1;
  NEW.aprovado_em           := NULL;
  NEW.aprovado_por          := NULL;
  NEW.primeira_aprovacao_em := NULL;
  NEW.snapshot_aprovado     := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.publicacao_trg_depois_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.publicacao_evento (
    embarcacao_id, roteiro_id, anuncio_venda_id, owner_id,
    tipo, status_anterior, status_novo, ator_id, ator_papel
  ) VALUES (
    CASE WHEN TG_TABLE_NAME = 'embarcacao'    THEN NEW.id END,
    CASE WHEN TG_TABLE_NAME = 'roteiro'       THEN NEW.id END,
    CASE WHEN TG_TABLE_NAME = 'anuncio_venda' THEN NEW.id END,
    NEW.owner_id,
    'criacao', NULL, NEW.status::text, NEW.owner_id, 'gestor'
  );
  RETURN NULL;
END;
$$;

-- 6b. UPDATE: status e colunas de controle só mudam por
--     transicionar_publicacao / publicacao_verificar_edicao.
CREATE OR REPLACE FUNCTION public.publicacao_trg_protege_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('boatzy.transicao_publicacao', true) IS DISTINCT FROM 'on' AND (
       NEW.status                IS DISTINCT FROM OLD.status
    OR NEW.status_alterado_em    IS DISTINCT FROM OLD.status_alterado_em
    OR NEW.enviado_analise_em    IS DISTINCT FROM OLD.enviado_analise_em
    OR NEW.aprovado_em           IS DISTINCT FROM OLD.aprovado_em
    OR NEW.aprovado_por          IS DISTINCT FROM OLD.aprovado_por
    OR NEW.primeira_aprovacao_em IS DISTINCT FROM OLD.primeira_aprovacao_em
    OR NEW.revisao               IS DISTINCT FROM OLD.revisao
    OR NEW.snapshot_aprovado     IS DISTINCT FROM OLD.snapshot_aprovado
  ) THEN
    RAISE EXCEPTION 'status_protegido: o status de publicação só muda pela pipeline de aprovação'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 6c. roteiro.ativo = visível no site (roteiro Ativo E embarcação Ativa).
CREATE OR REPLACE FUNCTION public.roteiro_trg_deriva_ativo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.ativo := NEW.status = 'ativo' AND (
    NEW.embarcacao_id IS NULL
    OR EXISTS (SELECT 1 FROM public.embarcacao e
               WHERE e.id = NEW.embarcacao_id AND e.status = 'ativo')
  );
  RETURN NEW;
END;
$$;

-- 6d. Embarcação mudou de status → recalcula a visibilidade dos roteiros.
CREATE OR REPLACE FUNCTION public.embarcacao_trg_propaga_roteiros()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.roteiro
  SET ativo = (status = 'ativo' AND NEW.status = 'ativo')
  WHERE embarcacao_id = NEW.id
    AND ativo IS DISTINCT FROM (status = 'ativo' AND NEW.status = 'ativo');
  RETURN NULL;
END;
$$;

-- Ordem dos BEFORE triggers é alfabética: "publicacao_1_*" roda antes.
DROP TRIGGER IF EXISTS publicacao_1_insert ON public.embarcacao;
CREATE TRIGGER publicacao_1_insert BEFORE INSERT ON public.embarcacao
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_antes_insert();
DROP TRIGGER IF EXISTS publicacao_1_insert ON public.roteiro;
CREATE TRIGGER publicacao_1_insert BEFORE INSERT ON public.roteiro
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_antes_insert();
DROP TRIGGER IF EXISTS publicacao_1_insert ON public.anuncio_venda;
CREATE TRIGGER publicacao_1_insert BEFORE INSERT ON public.anuncio_venda
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_antes_insert();

DROP TRIGGER IF EXISTS publicacao_evento_criacao ON public.embarcacao;
CREATE TRIGGER publicacao_evento_criacao AFTER INSERT ON public.embarcacao
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_depois_insert();
DROP TRIGGER IF EXISTS publicacao_evento_criacao ON public.roteiro;
CREATE TRIGGER publicacao_evento_criacao AFTER INSERT ON public.roteiro
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_depois_insert();
DROP TRIGGER IF EXISTS publicacao_evento_criacao ON public.anuncio_venda;
CREATE TRIGGER publicacao_evento_criacao AFTER INSERT ON public.anuncio_venda
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_depois_insert();

DROP TRIGGER IF EXISTS publicacao_1_protege ON public.embarcacao;
CREATE TRIGGER publicacao_1_protege BEFORE UPDATE ON public.embarcacao
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_protege_status();
DROP TRIGGER IF EXISTS publicacao_1_protege ON public.roteiro;
CREATE TRIGGER publicacao_1_protege BEFORE UPDATE ON public.roteiro
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_protege_status();
DROP TRIGGER IF EXISTS publicacao_1_protege ON public.anuncio_venda;
CREATE TRIGGER publicacao_1_protege BEFORE UPDATE ON public.anuncio_venda
  FOR EACH ROW EXECUTE FUNCTION public.publicacao_trg_protege_status();

DROP TRIGGER IF EXISTS publicacao_2_deriva_ativo ON public.roteiro;
CREATE TRIGGER publicacao_2_deriva_ativo BEFORE INSERT OR UPDATE ON public.roteiro
  FOR EACH ROW EXECUTE FUNCTION public.roteiro_trg_deriva_ativo();

DROP TRIGGER IF EXISTS publicacao_propaga_roteiros ON public.embarcacao;
CREATE TRIGGER publicacao_propaga_roteiros AFTER UPDATE OF status ON public.embarcacao
  FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.embarcacao_trg_propaga_roteiros();

-- Visibilidade inicial dos roteiros já com a regra nova
-- (o trigger 6c recalcula ativo em qualquer UPDATE).
UPDATE public.roteiro r
SET ativo = r.status = 'ativo' AND (
  r.embarcacao_id IS NULL
  OR EXISTS (SELECT 1 FROM public.embarcacao e WHERE e.id = r.embarcacao_id AND e.status = 'ativo')
);

-- ------------------------------------------------------------
-- 7. RLS de leitura pública da embarcação
--    Registro que nunca foi aprovado não é lido pela chave pública.
--    Os já publicados alguma vez continuam legíveis (histórico de
--    reservas, chat e favoritos dependem do join); as telas públicas
--    filtram status = 'ativo' explicitamente.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS public_read ON public.embarcacao;
CREATE POLICY public_read ON public.embarcacao
  FOR SELECT USING (
    primeira_aprovacao_em IS NOT NULL
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ------------------------------------------------------------
-- 8. Permissões das funções: só o servidor (service role) chama.
-- ------------------------------------------------------------

REVOKE ALL ON FUNCTION public.publicacao_snapshot(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publicacao_campos_alterados(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transicionar_publicacao(text, uuid, text, uuid, text, text, text, text[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publicacao_verificar_edicao(text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.publicacao_snapshot(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.publicacao_campos_alterados(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transicionar_publicacao(text, uuid, text, uuid, text, text, text, text[])
  TO service_role;
GRANT EXECUTE ON FUNCTION public.publicacao_verificar_edicao(text, uuid, uuid, text) TO service_role;
