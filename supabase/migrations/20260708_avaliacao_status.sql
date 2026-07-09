-- ============================================================
-- Moderação de avaliações pelo admin (/administrator/avaliacoes):
-- adiciona status para permitir aprovar antes da exibição pública
-- (reprovar = admin exclui a avaliação, não há estado "reprovada").
-- Avaliações já existentes (inseridas antes de existir moderação)
-- migram como 'aprovada' para não sumirem do site; novas avaliações
-- nascem 'pendente' e só ficam públicas após aprovação do admin.
-- ============================================================

CREATE TYPE avaliacao_status AS ENUM ('pendente', 'aprovada');

ALTER TABLE public.avaliacao
  ADD COLUMN status avaliacao_status NOT NULL DEFAULT 'pendente';

UPDATE public.avaliacao SET status = 'aprovada';

CREATE INDEX avaliacao_status_idx ON public.avaliacao (status);

-- Leitura pública passa a expor apenas avaliações aprovadas (a
-- moderação em si roda via supabaseAdmin nas páginas/queries que
-- usam service role e filtram status explicitamente).
DROP POLICY IF EXISTS public_read ON public.avaliacao;
CREATE POLICY public_read ON public.avaliacao
  FOR SELECT USING (status = 'aprovada');
