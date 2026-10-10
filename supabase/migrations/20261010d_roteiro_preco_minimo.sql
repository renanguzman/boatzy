-- ============================================================
-- PREÇO MÍNIMO DO ROTEIRO ("A partir de R$ X")
--
-- O preço de um roteiro varia conforme a data: `roteiro_preco_regra`
-- (data_fixa > periodo_anual > dia_semana) sobrepõe `preco_base`, e o gestor
-- pode manter os modelos Por Diária e Por Pessoa ativos em paralelo. Até aqui
-- card, detalhe, checkout e busca liam `preco_base` puro — as regras eram
-- cadastradas mas nunca aplicadas.
--
-- Esta migration materializa `roteiro.preco_minimo`: o menor valor que o
-- cliente pode efetivamente pagar. Materializada (e não calculada em leitura)
-- porque a busca filtra e ordena por preço, e o valor aparece em todo card.
--
-- `preco_minimo_modelo` guarda de qual modelo veio esse mínimo, porque a
-- unidade exibida muda com ele (/dia, /diária, /pessoa). Sem isso o front não
-- tem como saber: o mínimo do modelo Roteiro pode ter vindo de uma regra, não
-- de `preco_base`.
--
-- O cálculo varre a janela dos próximos 365 dias aplicando a MESMA prioridade
-- de `get_preco_roteiro`. Varrer datas (em vez de pegar MIN das regras) é o que
-- garante que o valor é alcançável de fato: se as regras cobrem todos os dias,
-- `preco_base` não entra no mínimo; e uma `data_fixa` já vencida é ignorada.
--
-- Como a janela desliza, o recálculo diário roda em /api/cron/preco-minimo.
-- ============================================================

ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS preco_minimo numeric(10, 2)
    CHECK (preco_minimo IS NULL OR preco_minimo >= 0),
  ADD COLUMN IF NOT EXISTS preco_minimo_modelo text
    CHECK (preco_minimo_modelo IS NULL
           OR preco_minimo_modelo IN ('roteiro', 'diaria', 'pessoa')),
  ADD COLUMN IF NOT EXISTS preco_minimo_roteiro numeric(10, 2)
    CHECK (preco_minimo_roteiro IS NULL OR preco_minimo_roteiro >= 0);

COMMENT ON COLUMN public.roteiro.preco_minimo IS
  'Menor preço alcançável nos próximos 365 dias, somando todos os modelos de '
  'cobrança ativos. Materializado por trigger; exibido como "A partir de R$ X". '
  'NULL = roteiro sem preço configurado ("Consulte o preço").';

COMMENT ON COLUMN public.roteiro.preco_minimo_modelo IS
  'Modelo de cobrança que originou `preco_minimo` — define a unidade exibida '
  'no card: roteiro=/dia, diaria=/diária, pessoa=/pessoa.';

COMMENT ON COLUMN public.roteiro.preco_minimo_roteiro IS
  'Menor preço SÓ do modelo Roteiro na janela de 365 dias. O card da busca usa '
  '`preco_minimo` (mínimo entre modelos); a aba Roteiro do card de reserva usa '
  'este, para não anunciar "a partir de" com o valor de outro modelo.';

-- ============================================================
-- FUNÇÃO: cálculo do preço mínimo
--
-- Recebe os valores do roteiro por parâmetro (e não só o id) para poder ser
-- usada no trigger BEFORE de `roteiro`, onde a linha nova ainda não está
-- visível na tabela. As regras são lidas por `p_roteiro_id`, que no BEFORE
-- INSERT já vem preenchido pelo default da PK.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_preco_minimo_roteiro(
  p_roteiro_id   uuid,
  p_preco_base   numeric,
  p_diaria_ativo boolean,
  p_diaria_valor numeric,
  p_pessoa_ativo boolean,
  p_pessoa_valor numeric
)
RETURNS TABLE (preco numeric(10, 2), modelo text, preco_roteiro numeric(10, 2))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'America/Sao_Paulo'
AS $$
  WITH dias AS (
    SELECT d::date AS data
    FROM generate_series(CURRENT_DATE, CURRENT_DATE + 365, interval '1 day') AS d
  ),
  -- Preço efetivo do modelo "Roteiro" em cada dia da janela, na mesma ordem de
  -- precedência de get_preco_roteiro: data_fixa > periodo_anual > dia_semana >
  -- preco_base. COALESCE para no primeiro nível que resolver.
  precos_dia AS (
    SELECT COALESCE(
      (SELECT rpr.valor
         FROM public.roteiro_preco_regra rpr
        WHERE rpr.roteiro_id = p_roteiro_id
          AND rpr.tipo  = 'data_fixa'
          AND rpr.ativo = true
          AND dias.data BETWEEN rpr.data_inicio AND rpr.data_fim
        ORDER BY rpr.prioridade DESC
        LIMIT 1),
      (SELECT rpr.valor
         FROM public.roteiro_preco_regra rpr
        WHERE rpr.roteiro_id = p_roteiro_id
          AND rpr.tipo  = 'periodo_anual'
          AND rpr.ativo = true
          AND (
            -- Período dentro do mesmo ano civil.
            (rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
               <= rpr.periodo_mes_fim * 100 + rpr.periodo_dia_fim
             AND (EXTRACT(MONTH FROM dias.data)::int * 100
                  + EXTRACT(DAY FROM dias.data)::int)
                 BETWEEN rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                     AND rpr.periodo_mes_fim    * 100 + rpr.periodo_dia_fim)
            OR
            -- Período que cruza a virada do ano (ex: 01/Dez → 28/Fev).
            (rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
               > rpr.periodo_mes_fim * 100 + rpr.periodo_dia_fim
             AND ((EXTRACT(MONTH FROM dias.data)::int * 100
                   + EXTRACT(DAY FROM dias.data)::int)
                    >= rpr.periodo_mes_inicio * 100 + rpr.periodo_dia_inicio
                  OR
                  (EXTRACT(MONTH FROM dias.data)::int * 100
                   + EXTRACT(DAY FROM dias.data)::int)
                    <= rpr.periodo_mes_fim * 100 + rpr.periodo_dia_fim))
          )
        ORDER BY rpr.prioridade DESC
        LIMIT 1),
      (SELECT rpr.valor
         FROM public.roteiro_preco_regra rpr
        WHERE rpr.roteiro_id = p_roteiro_id
          AND rpr.tipo  = 'dia_semana'
          AND rpr.ativo = true
          AND EXTRACT(DOW FROM dias.data)::int = ANY(rpr.dias_semana)
        ORDER BY rpr.prioridade DESC
        LIMIT 1),
      p_preco_base
    ) AS valor
    FROM dias
  ),
  min_roteiro AS (
    SELECT MIN(pd.valor)::numeric(10, 2) AS valor FROM precos_dia pd
  ),
  -- Um candidato por modelo ativo. Por Diária e Por Pessoa têm valor fixo (não
  -- variam por data), então entram direto. `ordem` desempata preços iguais
  -- preferindo a oferta mais forte: o barco inteiro (/dia) antes de /pessoa.
  candidatos AS (
    SELECT (SELECT valor FROM min_roteiro) AS preco, 'roteiro'::text AS modelo, 1 AS ordem
    UNION ALL
    SELECT p_diaria_valor::numeric(10, 2), 'diaria'::text, 2
     WHERE p_diaria_ativo IS TRUE AND p_diaria_valor IS NOT NULL
    UNION ALL
    SELECT p_pessoa_valor::numeric(10, 2), 'pessoa'::text, 3
     WHERE p_pessoa_ativo IS TRUE AND p_pessoa_valor IS NOT NULL
  )
  SELECT c.preco, c.modelo, (SELECT valor FROM min_roteiro)
    FROM candidatos c
   WHERE c.preco IS NOT NULL
   ORDER BY c.preco ASC, c.ordem ASC
   LIMIT 1;
$$;

-- Recalcula e grava, a partir do que está na tabela. Usado pelo trigger das
-- regras, pelo backfill e pelo cron diário.
CREATE OR REPLACE FUNCTION public.recalcular_preco_minimo_roteiro(p_roteiro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r          record;
  v_preco      numeric(10, 2);
  v_modelo     text;
  v_so_roteiro numeric(10, 2);
BEGIN
  SELECT preco_base, preco_diaria_ativo, preco_diaria_valor,
         preco_pessoa_ativo, preco_pessoa_valor
    INTO v_r
    FROM public.roteiro
   WHERE id = p_roteiro_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Zero linhas (nenhum modelo configurado) deixa as variáveis NULL, zerando
  -- as colunas em vez de manter um valor obsoleto.
  SELECT c.preco, c.modelo, c.preco_roteiro
    INTO v_preco, v_modelo, v_so_roteiro
  FROM public.calcular_preco_minimo_roteiro(
    p_roteiro_id, v_r.preco_base,
    v_r.preco_diaria_ativo, v_r.preco_diaria_valor,
    v_r.preco_pessoa_ativo, v_r.preco_pessoa_valor
  ) AS c;

  UPDATE public.roteiro
     SET preco_minimo         = v_preco,
         preco_minimo_modelo  = v_modelo,
         preco_minimo_roteiro = v_so_roteiro
   WHERE id = p_roteiro_id;
END;
$$;

-- Recálculo em massa (cron diário): a janela de 365 dias desliza, então um
-- preço de alta temporada pode entrar e uma data_fixa vencida pode sair.
CREATE OR REPLACE FUNCTION public.recalcular_precos_minimos_roteiros()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_id    uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.roteiro LOOP
    PERFORM public.recalcular_preco_minimo_roteiro(v_id);
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_roteiro_preco_minimo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_preco      numeric(10, 2);
  v_modelo     text;
  v_so_roteiro numeric(10, 2);
BEGIN
  SELECT c.preco, c.modelo, c.preco_roteiro
    INTO v_preco, v_modelo, v_so_roteiro
  FROM public.calcular_preco_minimo_roteiro(
    NEW.id, NEW.preco_base,
    NEW.preco_diaria_ativo, NEW.preco_diaria_valor,
    NEW.preco_pessoa_ativo, NEW.preco_pessoa_valor
  ) AS c;

  -- Zero linhas = nenhum modelo configurado: os campos ficam NULL e o front
  -- cai em "Consulte o preço".
  NEW.preco_minimo         := v_preco;
  NEW.preco_minimo_modelo  := v_modelo;
  NEW.preco_minimo_roteiro := v_so_roteiro;
  RETURN NEW;
END;
$$;

-- `UPDATE OF` restringe o disparo às colunas de preço — assim o UPDATE que o
-- trigger das regras faz em `preco_minimo` não reentra aqui.
DROP TRIGGER IF EXISTS trg_roteiro_preco_minimo ON public.roteiro;
CREATE TRIGGER trg_roteiro_preco_minimo
  BEFORE INSERT OR UPDATE OF
    preco_base, preco_diaria_ativo, preco_diaria_valor,
    preco_pessoa_ativo, preco_pessoa_valor
  ON public.roteiro
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_roteiro_preco_minimo();

CREATE OR REPLACE FUNCTION public.trg_roteiro_preco_regra_preco_minimo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recalcular_preco_minimo_roteiro(
    COALESCE(NEW.roteiro_id, OLD.roteiro_id)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_roteiro_preco_regra_preco_minimo ON public.roteiro_preco_regra;
CREATE TRIGGER trg_roteiro_preco_regra_preco_minimo
  AFTER INSERT OR UPDATE OR DELETE ON public.roteiro_preco_regra
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_roteiro_preco_regra_preco_minimo();

-- ============================================================
-- ÍNDICE + BACKFILL
-- ============================================================

-- Sustenta o filtro de faixa de preço e a ordenação preco_asc/desc da busca.
CREATE INDEX IF NOT EXISTS roteiro_preco_minimo_idx
  ON public.roteiro (preco_minimo)
  WHERE ativo = true;

SELECT public.recalcular_precos_minimos_roteiros();

GRANT EXECUTE ON FUNCTION public.calcular_preco_minimo_roteiro(uuid, numeric, boolean, numeric, boolean, numeric)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_preco_minimo_roteiro(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_precos_minimos_roteiros()   TO service_role;

-- `get_preco_roteiro` existe desde 20260907 mas nunca foi chamada pela
-- aplicação (o detalhe e o checkout liam `preco_base` puro). Agora é a fonte
-- do preço da data escolhida, então precisa estar exposta na Data API.
GRANT EXECUTE ON FUNCTION public.get_preco_roteiro(uuid, date)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
