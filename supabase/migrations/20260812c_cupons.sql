-- ============================================================
-- CUPONS DE DESCONTO (gestão exclusiva pelo admin)
--
-- Escopo desta migration: cadastro/gestão do cupom no admin
-- (/administrator/cupons). A APLICAÇÃO do cupom no fluxo de
-- reserva (/reservas/novo) fica para uma etapa futura — mas o
-- schema já nasce pronto para isso: `cupom_uso` registra cada uso
-- (rastreável, com valor de desconto aplicado) e sustenta tanto o
-- limite de uso quanto o repasse futuro a um parceiro.
--
-- Cadastro de parceiros ainda não existe no sistema; `parceiro`
-- aqui é intencionalmente mínima (id, nome, ativo) — só o
-- suficiente para o cupom referenciar um parceiro com integridade
-- referencial. Quando o cadastro completo for feito, esta tabela
-- é ESTENDIDA, não recriada.
-- ============================================================

CREATE TYPE cupom_tipo_desconto AS ENUM ('percentual', 'valor_fixo');

-- ── Tabela: parceiro (mínima, ver nota acima) ───────────────────

CREATE TABLE public.parceiro (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text        NOT NULL,
  ativo      boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Tabela: cupom ────────────────────────────────────────────

CREATE TABLE public.cupom (
  id                     uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),

  -- código único, sem espaço — normalizado em maiúsculas na aplicação
  codigo                 text                 NOT NULL UNIQUE,
  descricao              text,                                    -- nota interna, não exibida ao cliente

  tipo_desconto          cupom_tipo_desconto  NOT NULL,
  valor                  numeric(10, 2)       NOT NULL CHECK (valor > 0),
  valor_desconto_maximo  numeric(10, 2),                          -- teto em R$, só para tipo percentual
  valor_minimo_pedido    numeric(10, 2),                          -- total mínimo do roteiro p/ o cupom valer

  -- vigência: NULL em ambas = validade indeterminada (vale desde já, sem fim)
  data_inicio            date,
  data_fim               date,

  -- limites de uso: NULL = ilimitado
  limite_uso_total       integer,
  limite_uso_por_cliente integer,

  ativo                  boolean              NOT NULL DEFAULT true, -- pausa manual, independe da vigência por data

  parceiro_id            uuid                 REFERENCES public.parceiro(id) ON DELETE SET NULL,

  created_at             timestamptz          NOT NULL DEFAULT now(),
  updated_at             timestamptz          NOT NULL DEFAULT now(),

  CONSTRAINT cupom_codigo_formato        CHECK (codigo ~ '^[A-Z0-9_-]+$'),
  CONSTRAINT cupom_percentual_max_100    CHECK (tipo_desconto <> 'percentual' OR valor <= 100),
  CONSTRAINT cupom_teto_so_percentual    CHECK (tipo_desconto = 'percentual' OR valor_desconto_maximo IS NULL),
  CONSTRAINT cupom_teto_positivo         CHECK (valor_desconto_maximo IS NULL OR valor_desconto_maximo > 0),
  CONSTRAINT cupom_minimo_pedido_valido  CHECK (valor_minimo_pedido IS NULL OR valor_minimo_pedido >= 0),
  CONSTRAINT cupom_limite_total_valido   CHECK (limite_uso_total IS NULL OR limite_uso_total >= 1),
  CONSTRAINT cupom_limite_cliente_valido CHECK (limite_uso_por_cliente IS NULL OR limite_uso_por_cliente >= 1),
  CONSTRAINT cupom_vigencia_valida       CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio)
);

-- ── Tabela: cupom_uso (histórico — rastreabilidade e repasse) ──
--
-- Fica vazia até a aplicação do cupom ser integrada ao checkout.
-- `ON DELETE RESTRICT` em cupom_id é a trava de banco (rede de
-- segurança) para a regra "não excluir cupom já usado" — a
-- verificação de negócio principal fica na server action.

CREATE TABLE public.cupom_uso (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id       uuid           NOT NULL REFERENCES public.cupom(id) ON DELETE RESTRICT,
  reserva_id     uuid           REFERENCES public.reserva(id) ON DELETE SET NULL,
  cliente_id     uuid           REFERENCES public.users(id) ON DELETE SET NULL,
  valor_desconto numeric(10, 2) NOT NULL,
  criado_em      timestamptz    NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────

CREATE INDEX cupom_ativo_idx       ON public.cupom (ativo);
CREATE INDEX cupom_parceiro_idx    ON public.cupom (parceiro_id);
CREATE INDEX cupom_uso_cupom_idx   ON public.cupom_uso (cupom_id);
CREATE INDEX cupom_uso_cliente_idx ON public.cupom_uso (cliente_id);

-- ── Triggers updated_at (mesmo padrão de update_reserva_updated_at /
--    update_catalogo_updated_at) ────────────────────────────────

CREATE OR REPLACE FUNCTION update_parceiro_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parceiro_updated_at_trigger
  BEFORE UPDATE ON public.parceiro
  FOR EACH ROW EXECUTE FUNCTION update_parceiro_updated_at();

CREATE OR REPLACE FUNCTION update_cupom_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cupom_updated_at_trigger
  BEFORE UPDATE ON public.cupom
  FOR EACH ROW EXECUTE FUNCTION update_cupom_updated_at();

-- ============================================================
-- RLS
--
-- Só service_role: todo o CRUD de cupons/parceiros passa pelo
-- admin via supabaseAdmin (mesmo padrão de avaliacao/embarcacao/
-- roteiro no módulo administrativo). Sem policy pública — não há
-- consumo pelo lado cliente ainda (fica para quando o checkout
-- integrar o cupom).
-- ============================================================

ALTER TABLE public.parceiro  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupom     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupom_uso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.parceiro
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.cupom
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.cupom_uso
  FOR ALL TO service_role USING (true) WITH CHECK (true);
