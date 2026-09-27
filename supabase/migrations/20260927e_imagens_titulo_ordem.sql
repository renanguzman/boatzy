-- ============================================================
-- GALERIA DE IMAGENS — TÍTULO + ORDEM (embarcação e roteiro)
--
-- O gestor passa a dar um título a cada foto ("Proa do iate") — exibido
-- no site junto da foto — e a definir a ordem da galeria. A coluna
-- `titulo` já existia, mas era preenchida com o NOME DO ARQUIVO no
-- upload ("IMG_1234.jpg"); esses valores são limpos aqui para não
-- aparecerem ao cliente.
--
-- `ordem` (0, 1, 2…) é a sequência da galeria. Backfill: foto principal
-- primeiro, depois por data de envio — exatamente a ordem que o site já
-- mostrava, então nada muda visualmente para o que já existe.
--
-- Aditiva: pode rodar ANTES do deploy (a versão anterior ignora as
-- colunas novas). O código novo depende dela.
-- ============================================================

ALTER TABLE public.embarcacao_imagens
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

ALTER TABLE public.roteiro_imagens
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

-- Backfill da ordem atual ------------------------------------------------
UPDATE public.embarcacao_imagens AS i
   SET ordem = o.pos
  FROM (
    SELECT id,
           (row_number() OVER (PARTITION BY embarcacao_id
                               ORDER BY principal DESC, data_criacao, id) - 1)::integer AS pos
      FROM public.embarcacao_imagens
  ) AS o
 WHERE o.id = i.id;

UPDATE public.roteiro_imagens AS i
   SET ordem = o.pos
  FROM (
    SELECT id,
           (row_number() OVER (PARTITION BY roteiro_id
                               ORDER BY principal DESC, data_criacao, id) - 1)::integer AS pos
      FROM public.roteiro_imagens
  ) AS o
 WHERE o.id = i.id;

-- Títulos que são nomes de arquivo viram NULL ---------------------------
UPDATE public.embarcacao_imagens
   SET titulo = NULL
 WHERE titulo ~* '\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$';

UPDATE public.roteiro_imagens
   SET titulo = NULL
 WHERE titulo ~* '\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$';

-- Índices para ler a galeria já ordenada --------------------------------
CREATE INDEX IF NOT EXISTS embarcacao_imagens_ordem_idx
  ON public.embarcacao_imagens (embarcacao_id, ordem);

CREATE INDEX IF NOT EXISTS roteiro_imagens_ordem_idx
  ON public.roteiro_imagens (roteiro_id, ordem);
