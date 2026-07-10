-- ============================================================
-- Favoritos de embarcação.
-- O favorito passa a apontar para um roteiro OU uma embarcação
-- (exatamente um dos dois). O botão de coração dos cards de
-- embarcação (home "Mais Bem Avaliadas") grava aqui; /favoritos
-- lista os dois tipos. Um favorito por par usuário↔embarcação.
-- A escrita roda na server action alternarFavoritoEmbarcacao
-- (supabaseAdmin, valida sessão); a RLS é uma segunda camada.
-- ============================================================

ALTER TABLE public.favorito
  ALTER COLUMN roteiro_id DROP NOT NULL;

ALTER TABLE public.favorito
  ADD COLUMN embarcacao_id uuid REFERENCES public.embarcacao(id) ON DELETE CASCADE;

-- Exatamente um alvo por favorito (roteiro OU embarcação).
ALTER TABLE public.favorito
  ADD CONSTRAINT favorito_um_alvo_check
  CHECK (num_nonnulls(roteiro_id, embarcacao_id) = 1);

-- Um favorito por par usuário↔embarcação (o UNIQUE(user_id, roteiro_id)
-- original continua valendo para roteiros; linhas de embarcação têm
-- roteiro_id NULL e não colidem nele).
CREATE UNIQUE INDEX favorito_user_embarcacao_uniq
  ON public.favorito (user_id, embarcacao_id)
  WHERE embarcacao_id IS NOT NULL;

CREATE INDEX favorito_embarcacao_idx
  ON public.favorito (embarcacao_id)
  WHERE embarcacao_id IS NOT NULL;
