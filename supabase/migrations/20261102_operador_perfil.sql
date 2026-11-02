-- ============================================================
-- PERFIL DO OPERADOR (foto + nome de exibição + biografia)
--
-- Regra de produto: o gestor se apresenta ao cliente com foto, nome e
-- uma biografia. O texto só vai ao site DEPOIS de aprovado pelo admin
-- (/administrator/operadores). Editar um perfil já aprovado NÃO o tira
-- do ar: a versão publicada continua visível até a nova ser aprovada.
--
--   • operador_perfil — um registro por gestor. As colunas de conteúdo
--     (nome_publico, headline, bio, foto_url) são o RASCUNHO que o gestor
--     edita; `publicado` (jsonb) é a versão aprovada que o site lê.
--     `status`: rascunho → em_analise → aprovado | devolvido; o admin
--     pode `retirar` (retirado) e `restaurar`.
--   • operador_perfil_evento — histórico (quem fez o quê, com a
--     observação ao gestor e a observação interna só do admin).
--   • salvar_operador_perfil() / decidir_operador_perfil() — ÚNICAS
--     portas de mudança de status (SECURITY DEFINER, só service_role).
--     Um trigger bloqueia UPDATE direto de status/publicado.
--   • operador_resumos_publicos() — média das avaliações aprovadas,
--     experiências ativas e passeios realizados por operador (em lote).
--
-- A escrita roda nas server actions (supabaseAdmin); a RLS deixa o
-- gestor apenas LER o próprio registro (nenhuma policy de escrita para
-- `authenticated` → ele não se autoaprova). O site público lê via
-- supabaseAdmin SOMENTE `publicado`. Detalhes: SPEC §99.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Perfil
-- ------------------------------------------------------------

CREATE TABLE public.operador_perfil (
  owner_id              uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Rascunho (o que o gestor edita)
  nome_publico          text CHECK (nome_publico IS NULL OR char_length(nome_publico) <= 80),
  headline              text CHECK (headline IS NULL OR char_length(headline) <= 90),
  bio                   text CHECK (bio IS NULL OR char_length(bio) <= 1200),
  foto_url              text CHECK (foto_url IS NULL OR char_length(foto_url) <= 600),
  consentimento_em      timestamptz,

  status                text NOT NULL DEFAULT 'rascunho'
                          CHECK (status IN ('rascunho', 'em_analise', 'aprovado', 'devolvido', 'retirado')),
  enviado_analise_em    timestamptz,

  -- Versão aprovada (a única que o site lê): {nome_publico, headline, bio, foto_url}
  publicado             jsonb,
  aprovado_em           timestamptz,
  aprovado_por          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  primeira_aprovacao_em timestamptz,
  revisao               integer NOT NULL DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Sem versão publicada não há o que "retirar".
  CHECK (status <> 'retirado' OR publicado IS NOT NULL),
  CHECK (status <> 'aprovado' OR publicado IS NOT NULL)
);

-- Fila do admin (Em análise, mais antigos primeiro)
CREATE INDEX operador_perfil_fila_idx
  ON public.operador_perfil (enviado_analise_em) WHERE status = 'em_analise';
CREATE INDEX operador_perfil_status_idx
  ON public.operador_perfil (status);

ALTER TABLE public.operador_perfil ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operador_perfil TO anon, authenticated, service_role;

CREATE POLICY service_role_all ON public.operador_perfil
  TO service_role USING (true) WITH CHECK (true);

-- O gestor lê o próprio registro (rascunho + versão publicada). Escrita só pelo servidor.
CREATE POLICY user_select_own ON public.operador_perfil
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.operador_perfil_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER operador_perfil_updated_at_trigger
  BEFORE UPDATE ON public.operador_perfil
  FOR EACH ROW EXECUTE FUNCTION public.operador_perfil_set_updated_at();

-- Status e versão publicada só mudam pelas funções abaixo (flag de transação).
CREATE OR REPLACE FUNCTION public.operador_perfil_trg_protege()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('boatzy.operador_perfil_transicao', true) IS DISTINCT FROM 'on' AND (
       NEW.status                IS DISTINCT FROM OLD.status
    OR NEW.enviado_analise_em    IS DISTINCT FROM OLD.enviado_analise_em
    OR NEW.publicado             IS DISTINCT FROM OLD.publicado
    OR NEW.aprovado_em           IS DISTINCT FROM OLD.aprovado_em
    OR NEW.aprovado_por          IS DISTINCT FROM OLD.aprovado_por
    OR NEW.primeira_aprovacao_em IS DISTINCT FROM OLD.primeira_aprovacao_em
    OR NEW.revisao               IS DISTINCT FROM OLD.revisao
  ) THEN
    RAISE EXCEPTION 'status_protegido: o perfil do operador só muda de status pela aprovação'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER operador_perfil_1_protege
  BEFORE UPDATE ON public.operador_perfil
  FOR EACH ROW EXECUTE FUNCTION public.operador_perfil_trg_protege();

-- ------------------------------------------------------------
-- 2. Eventos (histórico)
--    Sem policy para `authenticated`: a observação interna é só do
--    admin; o gestor lê a linha do tempo pelo servidor.
-- ------------------------------------------------------------

CREATE TABLE public.operador_perfil_evento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo               text NOT NULL
                       CHECK (tipo IN ('enviado', 'recolhido', 'aprovado', 'devolvido', 'retirado', 'restaurado')),
  status_anterior    text,
  status_novo        text NOT NULL,
  observacao         text CHECK (observacao IS NULL OR char_length(observacao) <= 1000),
  observacao_interna text CHECK (observacao_interna IS NULL OR char_length(observacao_interna) <= 1000),
  snapshot           jsonb,
  ator_id            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ator_papel         text NOT NULL CHECK (ator_papel IN ('gestor', 'admin')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX operador_perfil_evento_owner_idx
  ON public.operador_perfil_evento (owner_id, created_at DESC);

ALTER TABLE public.operador_perfil_evento ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operador_perfil_evento TO anon, authenticated, service_role;

CREATE POLICY service_role_all ON public.operador_perfil_evento
  TO service_role USING (true) WITH CHECK (true);

-- Histórico não se reescreve (apagar só em cascata, com o usuário).
CREATE OR REPLACE FUNCTION public.operador_perfil_evento_trg_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'operador_perfil_evento é imutável' USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER operador_perfil_evento_sem_update
  BEFORE UPDATE ON public.operador_perfil_evento
  FOR EACH ROW EXECUTE FUNCTION public.operador_perfil_evento_trg_imutavel();

-- ------------------------------------------------------------
-- 3. Auxiliares
-- ------------------------------------------------------------

-- Conteúdo de um perfil no formato guardado em `publicado`.
CREATE OR REPLACE FUNCTION public.operador_perfil_conteudo(
  p_nome text, p_headline text, p_bio text, p_foto_url text
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'nome_publico', p_nome, 'headline', p_headline, 'bio', p_bio, 'foto_url', p_foto_url
  );
$$;

-- Perfil pronto para a análise: nome, bio (mín. 120), foto e autorização de exibição.
CREATE OR REPLACE FUNCTION public.operador_perfil_completo(
  p_nome text, p_bio text, p_foto_url text, p_consentimento_em timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(char_length(p_nome), 0) >= 2
     AND coalesce(char_length(p_bio), 0) >= 120
     AND p_foto_url IS NOT NULL
     AND p_consentimento_em IS NOT NULL;
$$;

-- ------------------------------------------------------------
-- 4. Gestor salva o perfil (e, se quiser, envia para análise)
--    Retorna {status, enviado, foto_antiga, atualizado_em}.
--    `foto_antiga`: arquivo do rascunho que saiu e não está no ar —
--    o servidor apaga do R2.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.salvar_operador_perfil(
  p_owner         uuid,
  p_nome          text,
  p_headline      text,
  p_bio           text,
  p_foto_url      text,
  p_consentimento boolean,
  p_enviar        boolean,
  p_versao        timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v            public.operador_perfil%ROWTYPE;
  v_nome       text := nullif(btrim(coalesce(p_nome, '')), '');
  v_headline   text := nullif(btrim(coalesce(p_headline, '')), '');
  v_bio        text := nullif(btrim(coalesce(p_bio, '')), '');
  v_foto       text := nullif(btrim(coalesce(p_foto_url, '')), '');
  v_consent    timestamptz;
  v_antes      jsonb;
  v_depois     jsonb;
  v_completo   boolean;
  v_igual      boolean;
  v_status     text;
  v_tipo       text;
  v_foto_antiga text;
  v_atualizado timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_owner AND role IN ('gestor', 'admin')) THEN
    RAISE EXCEPTION 'apenas_gestor';
  END IF;

  INSERT INTO operador_perfil (owner_id) VALUES (p_owner) ON CONFLICT (owner_id) DO NOTHING;
  SELECT * INTO v FROM operador_perfil WHERE owner_id = p_owner FOR UPDATE;

  IF p_versao IS NOT NULL AND v.updated_at IS DISTINCT FROM p_versao THEN
    RAISE EXCEPTION 'perfil_desatualizado';
  END IF;

  v_consent  := CASE WHEN p_consentimento THEN coalesce(v.consentimento_em, now()) END;
  v_antes    := operador_perfil_conteudo(v.nome_publico, v.headline, v.bio, v.foto_url);
  v_depois   := operador_perfil_conteudo(v_nome, v_headline, v_bio, v_foto);
  v_completo := operador_perfil_completo(v_nome, v_bio, v_foto, v_consent);
  v_igual    := v.publicado IS NOT NULL AND v.publicado = v_depois;

  -- Foto do rascunho que sai de cena (a que está no ar nunca é apagada aqui).
  IF v.foto_url IS NOT NULL
     AND v.foto_url IS DISTINCT FROM v_foto
     AND v.foto_url IS DISTINCT FROM (v.publicado ->> 'foto_url') THEN
    v_foto_antiga := v.foto_url;
  END IF;

  v_status := v.status;
  IF p_enviar THEN
    IF NOT v_completo THEN
      RAISE EXCEPTION 'perfil_incompleto';
    END IF;
    IF v_igual AND v.status <> 'retirado' THEN
      v_status := 'aprovado';            -- igual ao que está no ar: nada novo a revisar
    ELSE
      v_status := 'em_analise';
      v_tipo   := 'enviado';
    END IF;
  ELSIF v.status = 'em_analise' AND v_antes IS DISTINCT FROM v_depois THEN
    -- Editou sem reenviar: sai da fila (a equipe revisa sempre o que foi enviado).
    v_status := CASE WHEN v.publicado IS NULL THEN 'rascunho' ELSE 'aprovado' END;
    v_tipo   := 'recolhido';
  END IF;

  PERFORM set_config('boatzy.operador_perfil_transicao', 'on', true);
  UPDATE operador_perfil
     SET nome_publico       = v_nome,
         headline           = v_headline,
         bio                = v_bio,
         foto_url           = v_foto,
         consentimento_em   = v_consent,
         status             = v_status,
         enviado_analise_em = CASE
                                WHEN v_status = 'em_analise' AND v_tipo = 'enviado' THEN now()
                                WHEN v_status <> 'em_analise' THEN NULL
                                ELSE enviado_analise_em
                              END
   WHERE owner_id = p_owner
   RETURNING updated_at INTO v_atualizado;
  PERFORM set_config('boatzy.operador_perfil_transicao', '', true);

  IF v_tipo IS NOT NULL THEN
    INSERT INTO operador_perfil_evento (owner_id, tipo, status_anterior, status_novo, snapshot, ator_id, ator_papel)
    VALUES (p_owner, v_tipo, v.status, v_status, v_depois, p_owner, 'gestor');
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'enviado', coalesce(v_tipo = 'enviado', false),
    'foto_antiga', v_foto_antiga,
    'atualizado_em', v_atualizado
  );
END;
$$;

-- ------------------------------------------------------------
-- 5. Decisão do admin
--    aprovar (publica o rascunho) · devolver · retirar do ar · restaurar
--    `p_versao` (opcional): updated_at que o admin viu — se o gestor
--    mexeu no rascunho enquanto isso, a decisão é recusada.
--    Retorna {status, revisao, foto_antiga}.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decidir_operador_perfil(
  p_owner              uuid,
  p_decisao            text,
  p_admin_id           uuid,
  p_observacao         text DEFAULT NULL,
  p_observacao_interna text DEFAULT NULL,
  p_versao             timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v             public.operador_perfil%ROWTYPE;
  v_obs         text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_obs_int     text := nullif(btrim(coalesce(p_observacao_interna, '')), '');
  v_status      text;
  v_tipo        text;
  v_publicado   jsonb;
  v_foto_antiga text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'apenas_admin';
  END IF;
  IF p_decisao NOT IN ('aprovar', 'devolver', 'retirar', 'restaurar') THEN
    RAISE EXCEPTION 'decisao_invalida';
  END IF;

  SELECT * INTO v FROM operador_perfil WHERE owner_id = p_owner FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'perfil_inexistente';
  END IF;
  IF p_versao IS NOT NULL AND v.updated_at IS DISTINCT FROM p_versao THEN
    RAISE EXCEPTION 'perfil_desatualizado';
  END IF;

  v_publicado := v.publicado;

  IF p_decisao = 'aprovar' THEN
    IF v.status <> 'em_analise' THEN RAISE EXCEPTION 'perfil_fora_de_analise'; END IF;
    IF NOT operador_perfil_completo(v.nome_publico, v.bio, v.foto_url, v.consentimento_em) THEN
      RAISE EXCEPTION 'perfil_incompleto';
    END IF;
    v_status    := 'aprovado';
    v_tipo      := 'aprovado';
    v_publicado := operador_perfil_conteudo(v.nome_publico, v.headline, v.bio, v.foto_url);
    IF (v.publicado ->> 'foto_url') IS NOT NULL
       AND (v.publicado ->> 'foto_url') IS DISTINCT FROM v.foto_url THEN
      v_foto_antiga := v.publicado ->> 'foto_url';
    END IF;

  ELSIF p_decisao = 'devolver' THEN
    IF v.status <> 'em_analise' THEN RAISE EXCEPTION 'perfil_fora_de_analise'; END IF;
    IF v_obs IS NULL THEN RAISE EXCEPTION 'observacao_obrigatoria'; END IF;
    v_status := 'devolvido';
    v_tipo   := 'devolvido';

  ELSIF p_decisao = 'retirar' THEN
    IF v.publicado IS NULL OR v.status = 'retirado' THEN RAISE EXCEPTION 'perfil_nao_publicado'; END IF;
    IF v_obs IS NULL THEN RAISE EXCEPTION 'observacao_obrigatoria'; END IF;
    v_status := 'retirado';
    v_tipo   := 'retirado';

  ELSE -- restaurar
    IF v.status <> 'retirado' THEN RAISE EXCEPTION 'perfil_nao_retirado'; END IF;
    v_status := 'aprovado';
    v_tipo   := 'restaurado';
  END IF;

  PERFORM set_config('boatzy.operador_perfil_transicao', 'on', true);
  UPDATE operador_perfil
     SET status                = v_status,
         publicado             = v_publicado,
         aprovado_em           = CASE WHEN p_decisao = 'aprovar' THEN now() ELSE aprovado_em END,
         aprovado_por          = CASE WHEN p_decisao = 'aprovar' THEN p_admin_id ELSE aprovado_por END,
         primeira_aprovacao_em = CASE WHEN p_decisao = 'aprovar' THEN coalesce(primeira_aprovacao_em, now())
                                      ELSE primeira_aprovacao_em END,
         revisao               = CASE WHEN p_decisao = 'aprovar' THEN revisao + 1 ELSE revisao END,
         enviado_analise_em    = CASE WHEN v_status <> 'em_analise' THEN NULL ELSE enviado_analise_em END
   WHERE owner_id = p_owner;
  PERFORM set_config('boatzy.operador_perfil_transicao', '', true);

  INSERT INTO operador_perfil_evento
    (owner_id, tipo, status_anterior, status_novo, observacao, observacao_interna, snapshot, ator_id, ator_papel)
  VALUES
    (p_owner, v_tipo, v.status, v_status, v_obs, v_obs_int,
     operador_perfil_conteudo(v.nome_publico, v.headline, v.bio, v.foto_url), p_admin_id, 'admin');

  RETURN jsonb_build_object(
    'status', v_status,
    'revisao', v.revisao + CASE WHEN p_decisao = 'aprovar' THEN 1 ELSE 0 END,
    'foto_antiga', v_foto_antiga
  );
END;
$$;

-- ------------------------------------------------------------
-- 6. Resumo público por operador (em lote)
--    media: média das avaliações APROVADAS das reservas do operador
--    (reserva.owner_id) — inclui roteiros hoje inativos: a reputação
--    é do operador. NULL quando ainda não há avaliação.
--    passeios_realizados: reservas confirmadas/concluídas cuja data já
--    passou (a transição para 'concluida' é lazy, ver migration 025).
--    "Hoje" no fuso de Brasília (AGENTS.md → Datas e fuso horário).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.operador_resumos_publicos(p_owners uuid[])
RETURNS TABLE (
  owner_id             uuid,
  media                numeric,
  total_avaliacoes     integer,
  avaliacoes_pendentes integer,
  experiencias_ativas  integer,
  embarcacoes_ativas   integer,
  passeios_realizados  integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    (SELECT round(avg(a.nota)::numeric, 2)
       FROM avaliacao a JOIN reserva r ON r.id = a.reserva_id
      WHERE r.owner_id = o.id AND a.status = 'aprovada'),
    (SELECT count(*)::integer
       FROM avaliacao a JOIN reserva r ON r.id = a.reserva_id
      WHERE r.owner_id = o.id AND a.status = 'aprovada'),
    (SELECT count(*)::integer
       FROM avaliacao a JOIN reserva r ON r.id = a.reserva_id
      WHERE r.owner_id = o.id AND a.status = 'pendente'),
    (SELECT count(*)::integer FROM roteiro ro WHERE ro.owner_id = o.id AND ro.ativo = true),
    (SELECT count(*)::integer FROM embarcacao e WHERE e.owner_id = o.id AND e.status = 'ativo'),
    (SELECT count(*)::integer
       FROM reserva r
      WHERE r.owner_id = o.id
        AND r.status IN ('confirmada', 'concluida')
        AND r.data_reserva < (now() AT TIME ZONE 'America/Sao_Paulo')::date)
  FROM unnest(p_owners) AS o(id);
$$;

-- ------------------------------------------------------------
-- 7. Permissões das funções: só o servidor (service role) chama.
-- ------------------------------------------------------------

REVOKE ALL ON FUNCTION public.salvar_operador_perfil(uuid, text, text, text, text, boolean, boolean, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decidir_operador_perfil(uuid, text, uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.operador_resumos_publicos(uuid[])
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.salvar_operador_perfil(uuid, text, text, text, text, boolean, boolean, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.decidir_operador_perfil(uuid, text, uuid, text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.operador_resumos_publicos(uuid[])
  TO service_role;

-- ------------------------------------------------------------
-- 8. Avisos no sino do painel (aprovado / pede ajustes)
--    A lista abaixo repete a vigente (20261029b) e acrescenta os dois tipos.
-- ------------------------------------------------------------

ALTER TABLE public.notificacao DROP CONSTRAINT notificacao_tipo_valido;
ALTER TABLE public.notificacao ADD CONSTRAINT notificacao_tipo_valido CHECK (tipo IN (
  'reserva_solicitada',
  'reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida',
  'aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso', 'mensagem',
  'documento_vencendo', 'cobranca_avulsa', 'lembrete_passeio',
  'perfil_operador_aprovado', 'perfil_operador_ajustes'
));

NOTIFY pgrst, 'reload schema';
