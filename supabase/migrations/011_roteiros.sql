-- ─── Tabela: roteiro ─────────────────────────────────────────────────────────

CREATE TABLE public.roteiro (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  embarcacao_id     uuid        REFERENCES public.embarcacao(id) ON DELETE SET NULL,
  nome              text        NOT NULL,
  descricao         text        NOT NULL,
  duracao           text,
  quantidade_pessoas integer,
  origem            text,
  destino           text,
  municipio_id      integer     REFERENCES public.municipios(id),
  cep               char(8),
  bairro            text,
  logradouro        text,
  logradouro_numero text,
  complemento       text,
  latitude          numeric(10, 7),
  longitude         numeric(10, 7),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabela: roteiro_imagens ──────────────────────────────────────────────────

CREATE TABLE public.roteiro_imagens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id  uuid        NOT NULL REFERENCES public.roteiro(id) ON DELETE CASCADE,
  url_imagem  text        NOT NULL,
  titulo      text,
  principal   boolean     NOT NULL DEFAULT false,
  data_criacao timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.roteiro        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roteiro_imagens ENABLE ROW LEVEL SECURITY;

-- roteiro
CREATE POLICY "service_role_all"  ON public.roteiro FOR ALL       TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "owner_select_own"  ON public.roteiro FOR SELECT    TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner_insert_own"  ON public.roteiro FOR INSERT    TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_update_own"  ON public.roteiro FOR UPDATE    TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_delete_own"  ON public.roteiro FOR DELETE    TO authenticated USING (owner_id = auth.uid());

-- roteiro_imagens
CREATE POLICY "service_role_all"  ON public.roteiro_imagens FOR ALL    TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "public_read"       ON public.roteiro_imagens FOR SELECT  USING (true);
CREATE POLICY "owner_insert"      ON public.roteiro_imagens FOR INSERT  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid()));
CREATE POLICY "owner_delete"      ON public.roteiro_imagens FOR DELETE  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roteiro WHERE id = roteiro_id AND owner_id = auth.uid()));
