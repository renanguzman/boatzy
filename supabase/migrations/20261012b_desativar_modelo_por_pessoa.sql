-- ============================================================
-- Modelo de cobrança "Por Pessoa" removido do produto
--
-- O cadastro de roteiro (painel/admin) deixou de oferecer o modelo e o site
-- (card de reserva, confirmação, filtro da busca) deixou de aceitá-lo. Os
-- roteiros que ainda o tinham ativo são desligados aqui:
--
--   - o UPDATE de `preco_pessoa_ativo` dispara `trg_roteiro_preco_minimo`
--     (migration 20261010d), que recalcula `preco_minimo` /
--     `preco_minimo_modelo` sem o valor por pessoa — o card deixa de
--     anunciar "a partir de R$ X /pessoa";
--   - colunas `preco_pessoa_*`, o valor 'pessoa' de `reserva.modalidade_preco`
--     e a lógica SQL que os considera (`calcular_preco_minimo_roteiro`,
--     `buscar_roteiros`) ficam no banco: com o modelo sempre desligado não
--     têm efeito, e reservas antigas Por Pessoa continuam legíveis.
-- ============================================================

UPDATE public.roteiro
   SET preco_pessoa_ativo = false
 WHERE preco_pessoa_ativo IS TRUE;
