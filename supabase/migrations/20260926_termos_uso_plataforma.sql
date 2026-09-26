-- ============================================================
-- TERMOS DE USO DA PLATAFORMA (textos versionados)
--
-- Cada linha é uma VERSÃO de um termo. O `identificador` agrupa as
-- versões do mesmo termo (ex.: `reserva_cliente`) e é o que o código
-- usa para buscar a versão vigente. A lista de identificadores é FIXA
-- e vive no código (src/lib/termos/identificadores.ts) — o banco só
-- valida o formato.
--
-- Regra central (valor jurídico do aceite): um termo PUBLICADO é
-- imutável. Para mudar o texto, cria-se uma nova versão (rascunho) e
-- publica-se — a anterior é arquivada automaticamente. Isso é
-- garantido por trigger, não só pela aplicação.
--
-- Ciclo de vida: rascunho → publicado → arquivado
--   • rascunho : editável e excluível; no máx. 1 por identificador
--   • publicado: congelado (título/conteúdo/hash); no máx. 1 por identificador
--   • arquivado: congelado; histórico que sustenta aceites antigos
--
-- A tabela de aceites (`termos_uso_aceite`, fase 2) referenciará a
-- versão exata aceita com FK ON DELETE RESTRICT.
-- ============================================================

CREATE TYPE termo_uso_status AS ENUM ('rascunho', 'publicado', 'arquivado');

CREATE TABLE public.termos_uso_plataforma (
  id                          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),

  identificador               text              NOT NULL,
  versao                      integer           NOT NULL,                  -- atribuída por trigger (max + 1 por identificador)

  titulo                      text              NOT NULL,
  conteudo                    text              NOT NULL,                  -- Markdown
  -- SHA-256 (hex) de `titulo || '\n\n' || conteudo`, calculado pelo banco na publicação.
  -- Copiado para cada aceite: prova qual texto exato foi aceito.
  conteudo_hash               text,

  descricao_interna           text,                                        -- nota do admin, não exibida ao usuário

  status                      termo_uso_status  NOT NULL DEFAULT 'rascunho',

  -- Exigências na hora do aceite (consumidas pelo componente de aceite, fase 2/3)
  exige_rolagem_completa      boolean           NOT NULL DEFAULT true,     -- botão só libera após ler até o fim
  exige_confirmacao_digitada  boolean           NOT NULL DEFAULT true,     -- digitar nome completo (ou CPF, quando houver)

  criado_por                  uuid              REFERENCES public.users(id) ON DELETE SET NULL,
  publicado_por               uuid              REFERENCES public.users(id) ON DELETE SET NULL,
  publicado_em                timestamptz,                                 -- início da vigência
  arquivado_em                timestamptz,                                 -- fim da vigência

  data_cadastro               timestamptz       NOT NULL DEFAULT now(),
  data_atualizacao            timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT termos_uso_identificador_formato CHECK (identificador ~ '^[a-z0-9_]+$'),
  CONSTRAINT termos_uso_versao_positiva       CHECK (versao >= 1),
  CONSTRAINT termos_uso_titulo_preenchido     CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT termos_uso_conteudo_preenchido   CHECK (length(btrim(conteudo)) > 0),
  CONSTRAINT termos_uso_publicacao_coerente   CHECK (
    (status = 'rascunho'  AND publicado_em IS NULL     AND conteudo_hash IS NULL     AND arquivado_em IS NULL) OR
    (status = 'publicado' AND publicado_em IS NOT NULL AND conteudo_hash IS NOT NULL AND arquivado_em IS NULL) OR
    (status = 'arquivado' AND publicado_em IS NOT NULL AND conteudo_hash IS NOT NULL AND arquivado_em IS NOT NULL)
  ),
  CONSTRAINT termos_uso_identificador_versao_unq UNIQUE (identificador, versao)
);

-- No máximo 1 versão vigente e 1 rascunho por identificador.
CREATE UNIQUE INDEX termos_uso_um_publicado_idx
  ON public.termos_uso_plataforma (identificador) WHERE status = 'publicado';
CREATE UNIQUE INDEX termos_uso_um_rascunho_idx
  ON public.termos_uso_plataforma (identificador) WHERE status = 'rascunho';

CREATE INDEX termos_uso_data_cadastro_idx ON public.termos_uso_plataforma (data_cadastro DESC);

-- ─────────────────────────────────────────────────────────────
-- Trigger INSERT: nasce sempre como rascunho, com versão sequencial
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION termos_uso_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Um termo sempre é criado como rascunho — use a publicação para torná-lo vigente.';
  END IF;

  -- Serializa a numeração por identificador (evita corrida entre dois inserts).
  PERFORM pg_advisory_xact_lock(hashtext('termos_uso:' || NEW.identificador));

  SELECT COALESCE(MAX(versao), 0) + 1 INTO NEW.versao
    FROM public.termos_uso_plataforma
   WHERE identificador = NEW.identificador;

  NEW.conteudo_hash    := NULL;
  NEW.publicado_em     := NULL;
  NEW.publicado_por    := NULL;
  NEW.arquivado_em     := NULL;
  NEW.data_cadastro    := now();
  NEW.data_atualizacao := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER termos_uso_before_insert_trigger
  BEFORE INSERT ON public.termos_uso_plataforma
  FOR EACH ROW EXECUTE FUNCTION termos_uso_before_insert();

-- ─────────────────────────────────────────────────────────────
-- Trigger UPDATE: imutabilidade após publicação + transições válidas
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION termos_uso_before_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.identificador IS DISTINCT FROM OLD.identificador
     OR NEW.versao IS DISTINCT FROM OLD.versao
     OR NEW.data_cadastro IS DISTINCT FROM OLD.data_cadastro
     OR NEW.criado_por IS DISTINCT FROM OLD.criado_por THEN
    RAISE EXCEPTION 'Identificador, versão, autor e data de cadastro de um termo não podem ser alterados.';
  END IF;

  IF OLD.status = 'rascunho' THEN
    IF NEW.status = 'rascunho' THEN
      -- Edição livre do rascunho; campos de publicação permanecem vazios.
      NEW.conteudo_hash := NULL;
      NEW.publicado_em  := NULL;
      NEW.publicado_por := NULL;
      NEW.arquivado_em  := NULL;
    ELSIF NEW.status = 'publicado' THEN
      -- Publicação: o banco carimba a data e calcula o hash do texto final.
      NEW.publicado_em  := now();
      NEW.arquivado_em  := NULL;
      NEW.conteudo_hash := encode(sha256(convert_to(NEW.titulo || E'\n\n' || NEW.conteudo, 'UTF8')), 'hex');
    ELSE
      RAISE EXCEPTION 'Um rascunho só pode ser publicado ou excluído.';
    END IF;
  ELSE
    -- Publicado ou arquivado: texto e metadados de publicação congelados.
    IF NEW.titulo IS DISTINCT FROM OLD.titulo
       OR NEW.conteudo IS DISTINCT FROM OLD.conteudo
       OR NEW.conteudo_hash IS DISTINCT FROM OLD.conteudo_hash
       OR NEW.exige_rolagem_completa IS DISTINCT FROM OLD.exige_rolagem_completa
       OR NEW.exige_confirmacao_digitada IS DISTINCT FROM OLD.exige_confirmacao_digitada
       OR NEW.publicado_em IS DISTINCT FROM OLD.publicado_em
       OR NEW.publicado_por IS DISTINCT FROM OLD.publicado_por THEN
      RAISE EXCEPTION 'Termo publicado não pode ser alterado — crie uma nova versão.';
    END IF;

    IF OLD.status = 'publicado' AND NEW.status = 'arquivado' THEN
      NEW.arquivado_em := now();
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Transição de status inválida: % → %.', OLD.status, NEW.status;
    ELSIF NEW.arquivado_em IS DISTINCT FROM OLD.arquivado_em THEN
      RAISE EXCEPTION 'A data de arquivamento não pode ser alterada.';
    END IF;
  END IF;

  NEW.data_atualizacao := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER termos_uso_before_update_trigger
  BEFORE UPDATE ON public.termos_uso_plataforma
  FOR EACH ROW EXECUTE FUNCTION termos_uso_before_update();

-- ─────────────────────────────────────────────────────────────
-- Trigger DELETE: só rascunhos podem ser excluídos
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION termos_uso_before_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente rascunhos podem ser excluídos — versões publicadas ficam no histórico.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER termos_uso_before_delete_trigger
  BEFORE DELETE ON public.termos_uso_plataforma
  FOR EACH ROW EXECUTE FUNCTION termos_uso_before_delete();

-- ─────────────────────────────────────────────────────────────
-- RPC: publicação atômica (arquiva a vigente + publica o rascunho)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publicar_termo_uso(p_termo_id uuid, p_publicado_por uuid)
RETURNS void AS $$
DECLARE
  v_identificador text;
  v_status        termo_uso_status;
BEGIN
  SELECT identificador, status INTO v_identificador, v_status
    FROM public.termos_uso_plataforma
   WHERE id = p_termo_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termo não encontrado.';
  END IF;
  IF v_status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente rascunhos podem ser publicados.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('termos_uso:' || v_identificador));

  UPDATE public.termos_uso_plataforma
     SET status = 'arquivado'
   WHERE identificador = v_identificador
     AND status = 'publicado';

  UPDATE public.termos_uso_plataforma
     SET status = 'publicado',
         publicado_por = p_publicado_por
   WHERE id = p_termo_id;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.publicar_termo_uso(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_termo_uso(uuid, uuid) TO service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.termos_uso_plataforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.termos_uso_plataforma
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Qualquer visitante pode ler a versão vigente (exibição do termo antes do aceite).
-- Rascunhos e arquivados só são lidos pelo admin (service role).
CREATE POLICY "public_select_publicado" ON public.termos_uso_plataforma
  FOR SELECT TO anon, authenticated USING (status = 'publicado');
