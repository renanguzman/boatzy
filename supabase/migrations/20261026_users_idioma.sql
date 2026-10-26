-- Idioma preferido do usuário (26/10/2026) — SPEC §94.
--
-- O site passa a ter pt-BR, en-US e es. A escolha no seletor do Header vale para o navegador
-- (cookie NEXT_LOCALE) e, com usuário logado, também é gravada aqui — assim acompanha a conta em
-- outros aparelhos (o login copia para o cookie) e fica pronta para os e-mails no idioma da pessoa.
-- NULL = nunca escolheu (o site segue o idioma do navegador).
--
-- Coluna nova em tabela existente: não precisa de GRANT (a tabela já tem os da Data API).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS idioma text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_idioma_valido;
ALTER TABLE public.users
  ADD CONSTRAINT users_idioma_valido CHECK (idioma IS NULL OR idioma IN ('pt-BR', 'en-US', 'es'));

COMMENT ON COLUMN public.users.idioma IS
  'Idioma preferido do site (pt-BR, en-US, es). NULL = segue o navegador.';
