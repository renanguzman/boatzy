-- ============================================================
-- DOCUMENTOS — documentos da embarcação e habilitação dos
-- condutores, com gestão de validade (28/10/2026) — SPEC §95.
--
-- Estruturas:
--   documento               → um documento enviado pelo gestor
--   equipe_membro.funcao    → papel do membro (marinheiro, capitão, auxiliar)
--   notificacao tipo        → 'documento_vencendo' (aviso do gestor)
--
-- Tipos (registro em src/lib/documentos/tipos.ts):
--   embarcação: tie, tiem, dpem, prpm, outro
--   condutor  : cha, cir, outro
--
-- Só os dados essenciais do documento são gravados (nº, titular, nome da
-- embarcação, categoria, datas). CPF, nascimento e filiação lidos pelo OCR
-- ficam no navegador e são descartados.
--
-- O arquivo vai para o bucket R2 PRIVADO `boatzy-documentos`
-- (env R2_DOCUMENTOS_BUCKET_NAME); `arquivo_key` é a chave do objeto,
-- servido só por URL assinada para o dono.
--
-- Renovação: ao enviar um documento do mesmo tipo para a mesma embarcação
-- (ou o mesmo condutor), o anterior recebe `arquivado_em` e vira histórico.
-- No máximo um documento ATIVO por (embarcação, tipo) e por (membro, tipo),
-- exceto o tipo 'outro'.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- equipe_membro.funcao
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.equipe_membro
  ADD COLUMN IF NOT EXISTS funcao text
  CONSTRAINT equipe_membro_funcao_valida CHECK (funcao IN ('marinheiro', 'capitao', 'auxiliar'));

COMMENT ON COLUMN public.equipe_membro.funcao IS
  'Papel do membro na embarcação. Cadastro automático pela habilitação nasce como marinheiro.';

-- ─────────────────────────────────────────────────────────────
-- Tabela: documento
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.documento (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  escopo            text        NOT NULL CHECK (escopo IN ('embarcacao', 'condutor')),
  tipo              text        NOT NULL CHECK (tipo IN ('tie', 'tiem', 'dpem', 'prpm', 'cha', 'cir', 'outro')),
  embarcacao_id     uuid        REFERENCES public.embarcacao(id)    ON DELETE CASCADE,
  equipe_membro_id  uuid        REFERENCES public.equipe_membro(id) ON DELETE CASCADE,
  -- Nome do documento quando tipo = 'outro'.
  titulo            text,
  numero            text,
  -- Proprietário (embarcação) ou condutor (habilitação), como está no documento.
  titular           text,
  -- Nome da embarcação como está no documento.
  embarcacao_nome   text,
  -- Categoria da habilitação (CHA: motonauta, veleiro, arrais, mestre, capitao).
  categoria         text,
  data_emissao      date,
  -- NULL = documento sem validade (ex.: PRPM).
  data_validade     date,
  -- Extras não sensíveis lidos do documento (qtd. de passageiros, área de navegação…).
  dados             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  arquivo_key       text,
  arquivo_nome      text,
  arquivo_tipo      text,
  arquivo_tamanho   integer,
  -- Como os campos foram preenchidos: texto do PDF, OCR da foto ou digitação.
  origem            text        NOT NULL DEFAULT 'manual' CHECK (origem IN ('pdf', 'ocr', 'manual')),
  arquivado_em      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documento_alvo_valido CHECK (
    (escopo = 'embarcacao' AND embarcacao_id IS NOT NULL AND equipe_membro_id IS NULL AND tipo IN ('tie', 'tiem', 'dpem', 'prpm', 'outro'))
    OR
    (escopo = 'condutor' AND equipe_membro_id IS NOT NULL AND embarcacao_id IS NULL AND tipo IN ('cha', 'cir', 'outro'))
  ),
  CONSTRAINT documento_outro_com_titulo CHECK (tipo <> 'outro' OR nullif(trim(titulo), '') IS NOT NULL)
);

CREATE INDEX documento_owner_idx      ON public.documento (owner_id);
CREATE INDEX documento_embarcacao_idx ON public.documento (embarcacao_id);
CREATE INDEX documento_membro_idx     ON public.documento (equipe_membro_id);
-- Painel de validade e cron de avisos: só os ativos.
CREATE INDEX documento_validade_ativos_idx
  ON public.documento (owner_id, data_validade)
  WHERE arquivado_em IS NULL;

-- Um documento ativo por tipo e por alvo ('outro' pode repetir).
CREATE UNIQUE INDEX documento_embarcacao_tipo_ativo_uniq
  ON public.documento (embarcacao_id, tipo)
  WHERE arquivado_em IS NULL AND escopo = 'embarcacao' AND tipo <> 'outro';
CREATE UNIQUE INDEX documento_membro_tipo_ativo_uniq
  ON public.documento (equipe_membro_id, tipo)
  WHERE arquivado_em IS NULL AND escopo = 'condutor' AND tipo <> 'outro';

CREATE OR REPLACE FUNCTION public.update_documento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documento_updated_at_trigger
  BEFORE UPDATE ON public.documento
  FOR EACH ROW EXECUTE FUNCTION public.update_documento_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS (o backend usa supabaseAdmin; as policies são a rede de segurança)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.documento ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento TO anon, authenticated, service_role;

CREATE POLICY "service_role_all" ON public.documento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "owner_select_own" ON public.documento
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "owner_insert_own" ON public.documento
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update_own" ON public.documento
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete_own" ON public.documento
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Aviso do gestor: documento vencendo / vencido
-- (gravado pelo cron /api/cron/documentos-validade, chave
--  'gestor:doc:<id>:<marco>' — idempotente pelo índice notificacao_chave_uniq)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notificacao DROP CONSTRAINT notificacao_tipo_valido;
ALTER TABLE public.notificacao ADD CONSTRAINT notificacao_tipo_valido CHECK (tipo IN (
  'reserva_solicitada',
  'reserva_confirmada', 'reserva_recusada', 'reserva_cancelada', 'reserva_expirada', 'reserva_concluida',
  'aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'reembolso', 'mensagem',
  'documento_vencendo'
));
