-- ============================================================
-- Avaliações de reserva (cliente → roteiro/embarcação).
-- Regra de negócio (PRD §6.7/§8): apenas o cliente de uma reserva
-- CONCLUÍDA pode avaliar — nota 1–5 + comentário opcional; uma
-- avaliação por reserva (UNIQUE reserva_id).
-- roteiro_id/embarcacao_id são copiados da reserva no momento da
-- avaliação para consulta direta nas páginas públicas: a página do
-- roteiro lista por roteiro_id; a da embarcação por embarcacao_id
-- (inclui avaliações de roteiros feitos naquela embarcação).
-- A validação de status/posse roda na server action (supabaseAdmin);
-- a RLS de INSERT é uma segunda camada.
-- ============================================================

CREATE TABLE public.avaliacao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id    uuid NOT NULL UNIQUE REFERENCES public.reserva(id) ON DELETE CASCADE,
  cliente_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  roteiro_id    uuid REFERENCES public.roteiro(id) ON DELETE CASCADE,
  embarcacao_id uuid REFERENCES public.embarcacao(id) ON DELETE SET NULL,
  nota          smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario    text CHECK (comentario IS NULL OR char_length(comentario) <= 2000),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX avaliacao_roteiro_idx ON public.avaliacao (roteiro_id) WHERE roteiro_id IS NOT NULL;
CREATE INDEX avaliacao_embarcacao_idx ON public.avaliacao (embarcacao_id) WHERE embarcacao_id IS NOT NULL;

ALTER TABLE public.avaliacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON public.avaliacao
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Leitura pública: média e lista aparecem no hotsite.
CREATE POLICY public_read ON public.avaliacao
  FOR SELECT USING (true);

-- Cliente só insere avaliação própria, da própria reserva concluída.
CREATE POLICY cliente_insert ON public.avaliacao
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reserva r
      WHERE r.id = reserva_id
        AND r.cliente_id = auth.uid()
        AND r.status = 'concluida'
    )
  );
