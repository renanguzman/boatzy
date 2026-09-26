-- ============================================================
-- ACEITES DOS TERMOS DE USO (registro de evidências)
--
-- Cada linha prova que um usuário aceitou uma versão EXATA de um
-- termo, num contexto (ex.: reserva X), com o máximo de evidências:
--   • servidor (não forjáveis pelo cliente): data/hora do banco, IP e
--     cadeia x-forwarded-for, user-agent, sessão do Supabase Auth,
--     geolocalização aproximada pelo IP (headers da Vercel), URL de origem;
--   • navegador: tela, idioma, fuso, GPS (opcional — a recusa também é
--     registrada), confirmação digitada, tempo de leitura, rolagem até o fim.
--
-- Garantias (trigger, não só aplicação):
--   • APPEND-ONLY: UPDATE, DELETE e TRUNCATE são recusados, inclusive
--     para o service role.
--   • Só aceita a versão VIGENTE (status = 'publicado') do termo.
--   • Snapshot do termo (identificador, versão, hash do conteúdo) e do
--     usuário (nome, e-mail, CPF/CNPJ) copiado pelo próprio banco.
--   • Cadeia de hashes: cada aceite guarda o hash do anterior
--     (`hash_anterior`) e o seu próprio (`evidencia_hash`, SHA-256 da
--     forma canônica do registro). Qualquer alteração direta no banco
--     quebra a cadeia — detectável por `verificar_cadeia_termos_aceite()`.
--
-- `user_id` NÃO tem FK para `users` de propósito: a prova precisa
-- sobreviver à exclusão da conta (retenção por obrigação legal /
-- exercício regular de direitos — LGPD art. 7º, VI e art. 16) e um
-- ON DELETE SET NULL alteraria um registro imutável.
-- ============================================================

CREATE TABLE public.termos_uso_aceite (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  sequencia              bigint       NOT NULL UNIQUE,              -- ordem da cadeia, atribuída pelo trigger

  -- ── Termo aceito (snapshot preenchido pelo trigger) ──────────
  termo_id               uuid         NOT NULL REFERENCES public.termos_uso_plataforma(id) ON DELETE RESTRICT,
  termo_identificador    text         NOT NULL,
  termo_versao           integer      NOT NULL,
  termo_conteudo_hash    text         NOT NULL,

  -- ── Quem aceitou (snapshot preenchido pelo trigger) ──────────
  user_id                uuid         NOT NULL,                     -- sem FK, ver cabeçalho
  usuario_nome           text,
  usuario_email          text,
  usuario_cpf_cnpj       text,

  -- ── Em que ação ──────────────────────────────────────────────
  contexto_tipo          text         NOT NULL,                     -- ex.: 'reserva', 'embarcacao'
  contexto_id            uuid,                                     -- id da entidade da ação

  -- ── Evidências de servidor ───────────────────────────────────
  aceito_em              timestamptz  NOT NULL DEFAULT now(),       -- forçado pelo trigger
  ip                     inet,
  ip_cadeia              text,                                     -- x-forwarded-for bruto
  user_agent             text,
  sessao_id              text,                                     -- claim session_id do JWT do Supabase Auth
  origem_url             text,                                     -- header Referer
  dispositivo_tipo       text,                                     -- derivado do user-agent no servidor
  sistema_operacional    text,
  navegador              text,
  geo_ip_cidade          text,
  geo_ip_regiao          text,
  geo_ip_pais            text,
  geo_ip_latitude        numeric(9, 6),
  geo_ip_longitude       numeric(9, 6),

  -- ── Evidências do navegador ──────────────────────────────────
  tela_resolucao         text,                                     -- ex.: '1920x1080@2x'
  idioma                 text,
  fuso_horario           text,
  cliente_data_hora      timestamptz,                              -- relógio do dispositivo (informativo)
  geo_gps_status         text         NOT NULL DEFAULT 'nao_solicitada',
  geo_gps_latitude       numeric(9, 6),
  geo_gps_longitude      numeric(9, 6),
  geo_gps_precisao_m     numeric(10, 1),
  confirmacao_tipo       text,                                     -- 'nome' | 'cpf' | 'cnpj' | NULL (não exigida)
  confirmacao_valor      text,                                     -- o que o usuário digitou
  confirmacao_confere    boolean,
  termo_aberto_em        timestamptz,
  tempo_leitura_seg      integer,
  rolou_ate_fim          boolean,

  -- ── Integridade ──────────────────────────────────────────────
  hash_formato           smallint     NOT NULL DEFAULT 1,           -- versão da forma canônica usada no hash
  hash_anterior          text,                                     -- NULL só no primeiro aceite da cadeia
  evidencia_hash         text         NOT NULL,

  CONSTRAINT termos_aceite_contexto_formato CHECK (contexto_tipo ~ '^[a-z_]+$'),
  CONSTRAINT termos_aceite_dispositivo_valido CHECK (
    dispositivo_tipo IS NULL OR dispositivo_tipo IN ('desktop', 'smartphone', 'tablet', 'desconhecido')
  ),
  CONSTRAINT termos_aceite_gps_status_valido CHECK (
    geo_gps_status IN ('concedida', 'negada', 'indisponivel', 'tempo_esgotado', 'erro', 'nao_solicitada')
  ),
  CONSTRAINT termos_aceite_gps_coerente CHECK (
    (geo_gps_status = 'concedida') = (geo_gps_latitude IS NOT NULL AND geo_gps_longitude IS NOT NULL)
  ),
  CONSTRAINT termos_aceite_confirmacao_valida CHECK (
    (confirmacao_tipo IS NULL AND confirmacao_valor IS NULL AND confirmacao_confere IS NULL) OR
    (confirmacao_tipo IN ('nome', 'cpf', 'cnpj') AND confirmacao_valor IS NOT NULL AND confirmacao_confere IS NOT NULL)
  ),
  CONSTRAINT termos_aceite_tempo_leitura_valido CHECK (tempo_leitura_seg IS NULL OR tempo_leitura_seg >= 0)
);

CREATE INDEX termos_aceite_user_idx     ON public.termos_uso_aceite (user_id, aceito_em DESC);
CREATE INDEX termos_aceite_contexto_idx ON public.termos_uso_aceite (contexto_tipo, contexto_id);
CREATE INDEX termos_aceite_termo_idx    ON public.termos_uso_aceite (termo_id);

-- ─────────────────────────────────────────────────────────────
-- Forma canônica (v1) do registro para o hash.
-- Lista EXPLÍCITA de campos: uma coluna nova no futuro não altera o
-- hash de aceites antigos (entraria num formato v2). Fuso fixo em UTC
-- para que o texto das datas não dependa da sessão.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.termos_uso_aceite_canonico(r public.termos_uso_aceite)
RETURNS text AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'sequencia', r.sequencia,
    'termo_id', r.termo_id, 'termo_identificador', r.termo_identificador,
    'termo_versao', r.termo_versao, 'termo_conteudo_hash', r.termo_conteudo_hash,
    'user_id', r.user_id, 'usuario_nome', r.usuario_nome, 'usuario_email', r.usuario_email,
    'usuario_cpf_cnpj', r.usuario_cpf_cnpj,
    'contexto_tipo', r.contexto_tipo, 'contexto_id', r.contexto_id,
    'aceito_em', r.aceito_em, 'ip', r.ip, 'ip_cadeia', r.ip_cadeia, 'user_agent', r.user_agent,
    'sessao_id', r.sessao_id, 'origem_url', r.origem_url,
    'dispositivo_tipo', r.dispositivo_tipo, 'sistema_operacional', r.sistema_operacional,
    'navegador', r.navegador,
    'geo_ip_cidade', r.geo_ip_cidade, 'geo_ip_regiao', r.geo_ip_regiao, 'geo_ip_pais', r.geo_ip_pais,
    'geo_ip_latitude', r.geo_ip_latitude, 'geo_ip_longitude', r.geo_ip_longitude,
    'tela_resolucao', r.tela_resolucao, 'idioma', r.idioma, 'fuso_horario', r.fuso_horario,
    'cliente_data_hora', r.cliente_data_hora,
    'geo_gps_status', r.geo_gps_status, 'geo_gps_latitude', r.geo_gps_latitude,
    'geo_gps_longitude', r.geo_gps_longitude, 'geo_gps_precisao_m', r.geo_gps_precisao_m,
    'confirmacao_tipo', r.confirmacao_tipo, 'confirmacao_valor', r.confirmacao_valor,
    'confirmacao_confere', r.confirmacao_confere,
    'termo_aberto_em', r.termo_aberto_em, 'tempo_leitura_seg', r.tempo_leitura_seg,
    'rolou_ate_fim', r.rolou_ate_fim,
    'hash_formato', r.hash_formato, 'hash_anterior', r.hash_anterior
  )::text;
$$ LANGUAGE sql STABLE SET timezone = 'UTC';

CREATE OR REPLACE FUNCTION public.termos_uso_aceite_calcular_hash(r public.termos_uso_aceite)
RETURNS text AS $$
  SELECT encode(sha256(convert_to(public.termos_uso_aceite_canonico(r), 'UTF8')), 'hex');
$$ LANGUAGE sql STABLE SET timezone = 'UTC';

-- ─────────────────────────────────────────────────────────────
-- Trigger INSERT: valida o termo, faz os snapshots, encadeia e assina
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION termos_uso_aceite_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_termo public.termos_uso_plataforma%ROWTYPE;
  v_anterior record;
BEGIN
  SELECT * INTO v_termo FROM public.termos_uso_plataforma WHERE id = NEW.termo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termo não encontrado.';
  END IF;
  IF v_termo.status <> 'publicado' THEN
    RAISE EXCEPTION 'Só a versão vigente de um termo pode ser aceita (versão % está como %).',
      v_termo.versao, v_termo.status;
  END IF;

  NEW.termo_identificador := v_termo.identificador;
  NEW.termo_versao        := v_termo.versao;
  NEW.termo_conteudo_hash := v_termo.conteudo_hash;

  SELECT u.name, u.email, u.cpf_cnpj
    INTO NEW.usuario_nome, NEW.usuario_email, NEW.usuario_cpf_cnpj
    FROM public.users u
   WHERE u.id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário do aceite não encontrado.';
  END IF;

  NEW.aceito_em    := now();
  NEW.hash_formato := 1;

  -- Serializa a cadeia: um aceite por vez obtém sequência e hash anterior.
  PERFORM pg_advisory_xact_lock(hashtext('termos_uso_aceite:cadeia'));

  SELECT sequencia, evidencia_hash INTO v_anterior
    FROM public.termos_uso_aceite
   ORDER BY sequencia DESC
   LIMIT 1;

  NEW.sequencia      := COALESCE(v_anterior.sequencia, 0) + 1;
  NEW.hash_anterior  := v_anterior.evidencia_hash;
  NEW.evidencia_hash := public.termos_uso_aceite_calcular_hash(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER termos_uso_aceite_before_insert_trigger
  BEFORE INSERT ON public.termos_uso_aceite
  FOR EACH ROW EXECUTE FUNCTION termos_uso_aceite_before_insert();

-- ─────────────────────────────────────────────────────────────
-- Append-only: UPDATE / DELETE / TRUNCATE sempre recusados
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION termos_uso_aceite_imutavel()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registros de aceite são imutáveis (operação % não permitida).', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER termos_uso_aceite_no_update_trigger
  BEFORE UPDATE ON public.termos_uso_aceite
  FOR EACH ROW EXECUTE FUNCTION termos_uso_aceite_imutavel();

CREATE TRIGGER termos_uso_aceite_no_delete_trigger
  BEFORE DELETE ON public.termos_uso_aceite
  FOR EACH ROW EXECUTE FUNCTION termos_uso_aceite_imutavel();

CREATE TRIGGER termos_uso_aceite_no_truncate_trigger
  BEFORE TRUNCATE ON public.termos_uso_aceite
  FOR EACH STATEMENT EXECUTE FUNCTION termos_uso_aceite_imutavel();

-- ─────────────────────────────────────────────────────────────
-- RPC: auditoria da cadeia — lista cada aceite com problema
-- (hash que não confere com o conteúdo, ou elo quebrado com o anterior).
-- Resultado vazio = cadeia íntegra.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verificar_cadeia_termos_aceite()
RETURNS TABLE (sequencia bigint, aceite_id uuid, problema text) AS $$
DECLARE
  r public.termos_uso_aceite%ROWTYPE;
  v_hash_anterior text := NULL;
  v_seq_esperada  bigint := 1;
BEGIN
  FOR r IN SELECT * FROM public.termos_uso_aceite a ORDER BY a.sequencia LOOP
    IF r.sequencia <> v_seq_esperada THEN
      sequencia := r.sequencia; aceite_id := r.id;
      problema := format('sequência esperada %s', v_seq_esperada);
      RETURN NEXT;
    END IF;
    IF r.hash_anterior IS DISTINCT FROM v_hash_anterior THEN
      sequencia := r.sequencia; aceite_id := r.id;
      problema := 'elo quebrado: hash_anterior não corresponde ao aceite anterior';
      RETURN NEXT;
    END IF;
    IF r.evidencia_hash <> public.termos_uso_aceite_calcular_hash(r) THEN
      sequencia := r.sequencia; aceite_id := r.id;
      problema := 'conteúdo alterado: evidencia_hash não confere';
      RETURN NEXT;
    END IF;
    v_hash_anterior := r.evidencia_hash;
    v_seq_esperada  := r.sequencia + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SET timezone = 'UTC';

REVOKE ALL ON FUNCTION public.verificar_cadeia_termos_aceite() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_cadeia_termos_aceite() TO service_role;

-- ============================================================
-- RLS
-- Inserção só pelo servidor (service role), que captura as evidências
-- de servidor — o cliente nunca grava direto.
-- ============================================================
ALTER TABLE public.termos_uso_aceite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.termos_uso_aceite
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- O usuário consulta os próprios aceites (ex.: comprovante em "Minha conta").
CREATE POLICY "user_select_own" ON public.termos_uso_aceite
  FOR SELECT TO authenticated USING (user_id = auth.uid());
