-- ============================================================
-- MODELOS DE COBRANÇA DO ROTEIRO
--
-- Até aqui um roteiro só tinha um jeito de cobrar: `preco_base` (R$/dia) +
-- `roteiro_preco_regra` (dia da semana / período anual / data fixa) — o
-- modelo "Roteiro", que continua existindo sem mudanças e sem flag própria
-- (permanece implicitamente ativo quando há preco_base/regra, como hoje).
--
-- Esta migration acrescenta dois modelos NOVOS, que o gestor pode ativar
-- independentemente (um roteiro pode ter os 3 ligados ao mesmo tempo):
--
--   • Por Diária — passeio de vários dias, cobrado por diária, com uma
--     quantidade mínima de diárias configurável pelo gestor.
--   • Por Pessoa — bilheteria: valor fixo por pessoa. A capacidade pode
--     ser COMPARTILHADA (várias reservas de clientes diferentes dividem a
--     mesma data até lotar) ou EXCLUSIVA (uma única reserva ocupa o
--     roteiro inteiro naquela data, só muda a forma de cobrar).
--
-- A `reserva` passa a registrar qual modelo foi usado (`modalidade_preco`)
-- e o necessário para recalcular o subtotal como snapshot, no mesmo
-- espírito de `preco_base`/`taxa_servico`/etc. já documentado em SPEC §20.1.
-- ============================================================

-- ── roteiro: Por Diária ──────────────────────────────────────

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS preco_diaria_ativo  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preco_diaria_valor  numeric(10, 2)
    CHECK (preco_diaria_valor IS NULL OR preco_diaria_valor >= 0),
  ADD COLUMN IF NOT EXISTS preco_diaria_minimo integer NOT NULL DEFAULT 1
    CHECK (preco_diaria_minimo >= 1);

-- ── roteiro: Por Pessoa ───────────────────────────────────────

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS preco_pessoa_ativo            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preco_pessoa_valor             numeric(10, 2)
    CHECK (preco_pessoa_valor IS NULL OR preco_pessoa_valor >= 0),
  ADD COLUMN IF NOT EXISTS preco_pessoa_capacidade_minima integer
    CHECK (preco_pessoa_capacidade_minima IS NULL OR preco_pessoa_capacidade_minima >= 1),
  ADD COLUMN IF NOT EXISTS preco_pessoa_capacidade_maxima integer
    CHECK (preco_pessoa_capacidade_maxima IS NULL OR preco_pessoa_capacidade_maxima >= 1),
  ADD COLUMN IF NOT EXISTS preco_pessoa_modo_capacidade   text NOT NULL DEFAULT 'exclusivo'
    CHECK (preco_pessoa_modo_capacidade IN ('compartilhado', 'exclusivo'));

-- Capacidade máxima é obrigatória quando o modelo Por Pessoa está ativo
-- (sem ela não dá pra saber quando o roteiro está lotado).
ALTER TABLE public.roteiro
  ADD CONSTRAINT chk_roteiro_pessoa_capacidade_maxima CHECK (
    preco_pessoa_ativo = false OR preco_pessoa_capacidade_maxima IS NOT NULL
  );

-- Capacidade mínima (quando informada) não pode ultrapassar a máxima.
ALTER TABLE public.roteiro
  ADD CONSTRAINT chk_roteiro_pessoa_capacidade_min_max CHECK (
    preco_pessoa_capacidade_minima IS NULL
    OR preco_pessoa_capacidade_maxima IS NULL
    OR preco_pessoa_capacidade_minima <= preco_pessoa_capacidade_maxima
  );

-- ── reserva: modalidade de preço usada na solicitação ───────────

CREATE TYPE reserva_modalidade_preco AS ENUM ('roteiro', 'diaria', 'pessoa');

ALTER TABLE public.reserva
  ADD COLUMN IF NOT EXISTS modalidade_preco   reserva_modalidade_preco NOT NULL DEFAULT 'roteiro',
  ADD COLUMN IF NOT EXISTS quantidade_diarias integer
    CHECK (quantidade_diarias IS NULL OR quantidade_diarias >= 1),
  -- Checkout do modo Diária (data_reserva = check-in). NULL nos demais modos —
  -- nesse caso o intervalo ocupado é sempre o próprio dia de `data_reserva`.
  ADD COLUMN IF NOT EXISTS data_fim_reserva date;

ALTER TABLE public.reserva
  ADD CONSTRAINT chk_reserva_diaria_campos CHECK (
    (modalidade_preco = 'diaria' AND quantidade_diarias IS NOT NULL AND data_fim_reserva IS NOT NULL)
    OR (modalidade_preco != 'diaria' AND quantidade_diarias IS NULL AND data_fim_reserva IS NULL)
  );

-- Acelera a leitura de disponibilidade (Fase 2 do app: intervalos ocupados
-- por roteiro/embarcação, e soma de vagas ocupadas em Por Pessoa).
CREATE INDEX IF NOT EXISTS reserva_disponibilidade_idx
  ON public.reserva (roteiro_id, status, data_reserva, data_fim_reserva);

-- ============================================================
-- FUNÇÃO: preço efetivo do modelo "Roteiro" (diária única) numa data
--
-- As regras de `roteiro_preco_regra` já eram cadastradas pelo painel mas
-- nunca eram lidas — a exibição e a criação da reserva sempre usaram
-- `preco_base` puro. Esta função resolve o preço do dia seguindo a mesma
-- prioridade já usada para embarcação (`get_preco_embarcacao`, migration
-- 006): data_fixa > periodo_anual > dia_semana > preco_base (fallback).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_preco_roteiro(
  p_roteiro_id uuid,
  p_data       date
)
RETURNS numeric(10, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_preco   numeric(10, 2);
  v_mmdd    integer := EXTRACT(MONTH FROM p_data)::int * 100
                       + EXTRACT(DAY FROM p_data)::int;
BEGIN

  -- ── 1. data_fixa ────────────────────────────────────────────
  SELECT valor INTO v_preco
  FROM   public.roteiro_preco_regra
  WHERE  roteiro_id = p_roteiro_id
    AND  tipo       = 'data_fixa'
    AND  ativo      = true
    AND  p_data BETWEEN data_inicio AND data_fim
  ORDER  BY prioridade DESC
  LIMIT  1;

  IF FOUND THEN RETURN v_preco; END IF;

  -- ── 2. periodo_anual (suporta cruzamento de ano) ─────────────
  SELECT valor INTO v_preco
  FROM   public.roteiro_preco_regra
  WHERE  roteiro_id = p_roteiro_id
    AND  tipo       = 'periodo_anual'
    AND  ativo      = true
    AND  (
      (periodo_mes_inicio * 100 + periodo_dia_inicio
         <= periodo_mes_fim * 100 + periodo_dia_fim
       AND v_mmdd BETWEEN
             periodo_mes_inicio * 100 + periodo_dia_inicio
         AND periodo_mes_fim    * 100 + periodo_dia_fim)
      OR
      (periodo_mes_inicio * 100 + periodo_dia_inicio
         > periodo_mes_fim * 100 + periodo_dia_fim
       AND (v_mmdd >= periodo_mes_inicio * 100 + periodo_dia_inicio
            OR
            v_mmdd <= periodo_mes_fim    * 100 + periodo_dia_fim))
    )
  ORDER  BY prioridade DESC
  LIMIT  1;

  IF FOUND THEN RETURN v_preco; END IF;

  -- ── 3. dia_semana ───────────────────────────────────────────
  SELECT valor INTO v_preco
  FROM   public.roteiro_preco_regra
  WHERE  roteiro_id = p_roteiro_id
    AND  tipo       = 'dia_semana'
    AND  ativo      = true
    AND  EXTRACT(DOW FROM p_data)::int = ANY(dias_semana)
  ORDER  BY prioridade DESC
  LIMIT  1;

  IF FOUND THEN RETURN v_preco; END IF;

  -- ── 4. preco_base (fallback) ────────────────────────────────
  SELECT preco_base INTO v_preco
  FROM   public.roteiro
  WHERE  id = p_roteiro_id;

  RETURN v_preco;

END;
$$;
