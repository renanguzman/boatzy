-- ============================================================
-- DURAÇÃO DO ROTEIRO EM HORAS (valor numérico para busca)
-- `roteiro.duracao` sempre foi texto livre ("4 horas", "3 dias /
-- 2 noites"), o que serve para exibir mas impede filtrar por faixa
-- e ordenar. Passa a existir `duracao_horas numeric`, gravado pelo
-- painel a partir de número + unidade (Horas/Dias); o texto segue
-- existindo e é derivado desse par no cadastro.
-- Convenção: 1 dia = 24 horas (passeio com pernoite ≠ passeio de
-- dia inteiro — a distinção importa no filtro).
-- ============================================================

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS duracao_horas numeric(6, 2)
    CHECK (duracao_horas IS NULL OR duracao_horas > 0);

COMMENT ON COLUMN public.roteiro.duracao_horas IS
  'Duração do passeio em horas (1 dia = 24h). Alimenta os filtros e a ordenação de /buscar; roteiro.duracao é o rótulo exibido.';

-- Backfill dos registros existentes: extrai o primeiro número do
-- texto e converte para horas conforme a unidade mencionada.
-- Casos sem número reconhecível ficam NULL (não aparecem quando o
-- filtro de duração está ativo — mesma regra do filtro de pessoas).
UPDATE public.roteiro r
SET duracao_horas = sub.horas
FROM (
  SELECT
    id,
    CASE
      WHEN duracao ~* 'meia\s+hora'  THEN 0.5
      WHEN duracao ~* 'meio\s+dia'   THEN 12
      ELSE
        NULLIF(
          replace(substring(duracao from '([0-9]+(?:[.,][0-9]+)?)'), ',', '.'),
          ''
        )::numeric
        * CASE WHEN duracao ~* '(dia|noite|pernoite|diária)' THEN 24 ELSE 1 END
    END AS horas
  FROM public.roteiro
  WHERE duracao IS NOT NULL AND btrim(duracao) <> ''
) sub
WHERE r.id = sub.id
  AND sub.horas IS NOT NULL
  AND sub.horas > 0
  AND sub.horas <= 9999
  AND r.duracao_horas IS NULL;

-- Filtro/ordenação por duração varrem só roteiros ativos.
CREATE INDEX IF NOT EXISTS roteiro_duracao_horas_idx
  ON public.roteiro (duracao_horas)
  WHERE ativo = true AND duracao_horas IS NOT NULL;

-- Filtro/ordenação por preço, idem.
CREATE INDEX IF NOT EXISTS roteiro_preco_base_idx
  ON public.roteiro (preco_base)
  WHERE ativo = true AND preco_base IS NOT NULL;
