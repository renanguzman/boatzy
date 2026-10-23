-- ============================================================
-- Registro do consentimento de cookies (LGPD) — evidência de cada
-- escolha feita no banner ou em Minha conta (SPEC §66).
--
-- Uma linha por escolha (histórico; a vigente é a mais recente do
-- visitante/usuário). O navegador guarda a escolha no cookie
-- `boatzy_consentimento`; aqui fica a prova: quem (usuário logado e/ou
-- id anônimo do navegador), o quê (categorias), quando, em qual versão
-- da política e de onde (banner / minha_conta). Sem IP.
--
-- Gravação só pelo servidor (server action com service role).
-- ============================================================

CREATE TABLE public.consentimento_cookies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visitante_id     uuid        NOT NULL,                 -- id anônimo gravado no cookie de consentimento
  user_id          uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  medicao          boolean     NOT NULL,                 -- Google Analytics (cookies de medição)
  versao_politica  text        NOT NULL,
  origem           text        NOT NULL,
  user_agent       text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consentimento_cookies_origem_valida CHECK (origem IN ('banner', 'minha_conta'))
);

CREATE INDEX consentimento_cookies_visitante_idx ON public.consentimento_cookies (visitante_id, criado_em DESC);
CREATE INDEX consentimento_cookies_user_idx ON public.consentimento_cookies (user_id, criado_em DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.consentimento_cookies ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consentimento_cookies TO anon, authenticated, service_role;

CREATE POLICY service_role_all ON public.consentimento_cookies
  TO service_role USING (true) WITH CHECK (true);

-- O titular pode consultar o próprio histórico (direito de acesso, LGPD art. 18).
CREATE POLICY user_select_own ON public.consentimento_cookies
  FOR SELECT TO authenticated USING (user_id = auth.uid());
