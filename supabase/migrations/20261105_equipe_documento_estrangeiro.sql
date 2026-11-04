-- ============================================================
-- Equipe: membro estrangeiro, sem CPF (05/11/2026) — SPEC §104.
--
-- O gestor pode cadastrar marinheiro/capitão estrangeiro marcando "Não tenho CPF"
-- e informando outro documento oficial. Sem tabela nova (nenhum GRANT adicional).
--
--   equipe_membro.tipo_documento_estrangeiro  'passaporte' | 'registro_identificacao'
--   equipe_membro.documento_estrangeiro       número normalizado (A–Z, 0–9, 4–20)
--   equipe_membro.pais_documento              país emissor (ISO 3166-1 alfa-2)
--
-- Os três vêm juntos ou todos nulos, e nunca junto com CPF (um ou outro).
-- ============================================================

ALTER TABLE public.equipe_membro
  ADD COLUMN tipo_documento_estrangeiro text,
  ADD COLUMN documento_estrangeiro      text,
  ADD COLUMN pais_documento             text,
  ADD CONSTRAINT equipe_membro_documento_estrangeiro_valido CHECK (
    (tipo_documento_estrangeiro IS NULL AND documento_estrangeiro IS NULL AND pais_documento IS NULL)
    OR (
      tipo_documento_estrangeiro IN ('passaporte', 'registro_identificacao')
      AND documento_estrangeiro ~ '^[A-Z0-9]{4,20}$'
      AND pais_documento ~ '^[A-Z]{2}$'
      AND cpf IS NULL
    )
  );

-- Mesmo documento + país não se repete na equipe do mesmo gestor (equivale ao índice único do CPF).
CREATE UNIQUE INDEX equipe_membro_owner_doc_estrangeiro_uniq
  ON public.equipe_membro (owner_id, pais_documento, documento_estrangeiro)
  WHERE documento_estrangeiro IS NOT NULL;

COMMENT ON COLUMN public.equipe_membro.documento_estrangeiro IS
  'Documento oficial de membro estrangeiro sem CPF (passaporte ou registro de identificação), normalizado — SPEC §104.';
