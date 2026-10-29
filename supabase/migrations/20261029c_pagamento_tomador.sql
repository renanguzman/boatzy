-- ============================================================
-- Em nome de quem sai o pagamento (29/10/2026) — SPEC §97.
--
-- No checkout o cliente escolhe em nome de quem o comprovante (e, no
-- futuro, a nota fiscal) é emitido: ele mesmo, outra pessoa (CPF) ou uma
-- empresa (CNPJ). A cobrança no Asaas vai para um customer com esses dados.
--
-- `pagamento_tomador` é o snapshot desses dados por tentativa de pagamento
-- (1:1 com `pagamento`): o comprovante, o painel do gestor e o admin mostram
-- exatamente o que foi escolhido, mesmo que o cadastro mude depois.
-- Pagamentos anteriores a esta migration não têm linha (= o próprio cliente).
--
--   tipo 'proprio'  dados do cadastro do cliente (endereço opcional)
--   tipo 'cpf'      outra pessoa — nome, CPF, telefone e endereço obrigatórios
--   tipo 'cnpj'     empresa — razão social, CNPJ e endereço obrigatórios
--                   (preenchidos pela consulta ao OpenCNPJ, editáveis)
-- ============================================================

CREATE TABLE public.pagamento_tomador (
  pagamento_id   uuid        PRIMARY KEY REFERENCES public.pagamento(id) ON DELETE CASCADE,
  tipo           text        NOT NULL,
  nome           text        NOT NULL,              -- nome completo ou razão social
  documento      text        NOT NULL,              -- CPF (11) ou CNPJ (14), só dígitos
  nome_fantasia  text,
  email          text,
  telefone       text,                              -- só dígitos (DDD + número)
  cep            text,                              -- só dígitos
  logradouro     text,
  numero         text,
  complemento    text,
  bairro         text,
  cidade         text,
  uf             text,
  criado_em      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pagamento_tomador_tipo_valido CHECK (tipo IN ('proprio', 'cpf', 'cnpj')),
  CONSTRAINT pagamento_tomador_nome_valido CHECK (char_length(btrim(nome)) BETWEEN 2 AND 200),
  CONSTRAINT pagamento_tomador_documento_valido CHECK (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  CONSTRAINT pagamento_tomador_documento_coerente CHECK (
    (tipo <> 'cpf' OR char_length(documento) = 11) AND (tipo <> 'cnpj' OR char_length(documento) = 14)
  ),
  CONSTRAINT pagamento_tomador_telefone_valido CHECK (telefone IS NULL OR telefone ~ '^[0-9]{10,11}$'),
  CONSTRAINT pagamento_tomador_cep_valido CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$'),
  CONSTRAINT pagamento_tomador_uf_valida CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  -- Terceiros: endereço completo (exigido para a nota fiscal); CPF de terceiro também exige telefone.
  CONSTRAINT pagamento_tomador_terceiro_completo CHECK (
    tipo = 'proprio' OR (
      cep IS NOT NULL AND NULLIF(btrim(logradouro), '') IS NOT NULL AND NULLIF(btrim(numero), '') IS NOT NULL
      AND NULLIF(btrim(bairro), '') IS NOT NULL AND NULLIF(btrim(cidade), '') IS NOT NULL AND uf IS NOT NULL
    )
  ),
  CONSTRAINT pagamento_tomador_cpf_telefone CHECK (tipo <> 'cpf' OR telefone IS NOT NULL)
);

COMMENT ON TABLE public.pagamento_tomador IS
  'Em nome de quem a tentativa de pagamento foi emitida (comprovante / futura nota fiscal) — SPEC §97.';

-- ------------------------------------------------------------
-- RLS + GRANTs (AGENTS.md). Escritas só pelo servidor (service role).
-- ------------------------------------------------------------
ALTER TABLE public.pagamento_tomador ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamento_tomador TO anon, authenticated, service_role;

CREATE POLICY "service_role_all" ON public.pagamento_tomador FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cliente e gestor do pedido leem (o gestor precisa dos dados para a nota fiscal).
CREATE POLICY "participante_select" ON public.pagamento_tomador FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pagamento pg JOIN public.pedido p ON p.id = pg.pedido_id
                 WHERE pg.id = pagamento_id AND (p.cliente_id = auth.uid() OR p.gestor_id = auth.uid())));
