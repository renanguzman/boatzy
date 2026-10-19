/**
 * Cálculo dos valores do pedido — puro (sem I/O), usado no servidor e na
 * prévia do painel. Mesmas regras da solicitação (`/reservas/novo`):
 *
 *   itens     = preço unitário × multiplicador + adicionais   (vai para o gestor)
 *   comissão  = round(itens × taxa%)  — em reais inteiros, como na solicitação
 *   desconto  = cupom, LIMITADO ao valor da comissão (decisão D7)
 *   total     = itens + comissão − desconto  (o que o cliente paga)
 */

import type { ReservaModalidadePreco } from '@/types/supabase';

/** Menor valor que o Asaas aceita numa cobrança (Pix/cartão). */
export const VALOR_MINIMO_COBRANCA = 5;

export function arredondarCentavos(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Quantas vezes o preço unitário entra no total: diárias, pessoas ou 1 (roteiro/embarcação). */
export function multiplicadorDaReserva(r: {
  modalidade_preco: ReservaModalidadePreco;
  quantidade_diarias: number | null;
  quantidade_pessoas: number;
}): number {
  if (r.modalidade_preco === 'diaria') return r.quantidade_diarias ?? 1;
  if (r.modalidade_preco === 'pessoa') return r.quantidade_pessoas;
  return 1;
}

export type ValoresPedido = {
  valorItens: number;
  valorComissao: number;
  valorDesconto: number;
  valorTotal: number;
};

export function calcularValoresPedido(input: {
  precoUnitario: number;
  multiplicador: number;
  totalAdicionais: number;
  taxaPercent: number;
  descontoCupom: number;
}): ValoresPedido {
  const valorItens = arredondarCentavos(input.precoUnitario * input.multiplicador + input.totalAdicionais);
  const valorComissao = Math.round(valorItens * (input.taxaPercent / 100));
  const valorDesconto = arredondarCentavos(Math.max(0, Math.min(input.descontoCupom, valorComissao)));
  const valorTotal = arredondarCentavos(Math.max(0, valorItens + valorComissao - valorDesconto));
  return { valorItens, valorComissao, valorDesconto, valorTotal };
}

// ── Valores como o CLIENTE vê ───────────────────────────────────────────────
// O site nunca mostra a taxa de serviço em linha própria (19/10/2026): todo
// valor exibido ao cliente já vem com a taxa embutida. O gestor continua vendo
// o detalhamento (Você recebe × Cliente paga) no painel.

/** Preço de um item (passeio, diária, adicional) com a taxa de serviço embutida. */
export function precoComTaxa(preco: number, taxaPercent: number): number {
  return calcularValoresPedido({
    precoUnitario: preco, multiplicador: 1, totalAdicionais: 0, taxaPercent, descontoCupom: 0,
  }).valorTotal;
}

export type ValoresCliente = {
  /** Passeio/diárias com a taxa — o mesmo valor do cabeçalho e do calendário. */
  passeio: number;
  /** Adicionais com a taxa. Fica com o arredondamento para as linhas somarem o total exato. */
  adicionais: number;
  desconto: number;
  /** O que o cliente paga (= `calcularValoresPedido().valorTotal`). */
  total: number;
};

/**
 * Detalhamento do pedido para o cliente: mesma conta de `calcularValoresPedido`,
 * com a taxa distribuída nas linhas. A taxa é calculada em reais inteiros sobre o
 * pedido todo, então somar as linhas com a taxa de cada uma pode diferir do total
 * em R$ 1 — a diferença vai para a linha de adicionais, nunca para o passeio.
 */
export function valoresParaCliente(input: {
  precoUnitario: number;
  multiplicador: number;
  totalAdicionais: number;
  taxaPercent: number;
  descontoCupom: number;
}): ValoresCliente {
  const v = calcularValoresPedido(input);
  const passeio = precoComTaxa(input.precoUnitario * input.multiplicador, input.taxaPercent);
  return {
    passeio,
    adicionais: input.totalAdicionais > 0 ? arredondarCentavos(v.valorItens + v.valorComissao - passeio) : 0,
    desconto: v.valorDesconto,
    total: v.valorTotal,
  };
}

/** Opções de parcelamento do cartão: 1..parcelasMax, respeitando o valor mínimo por parcela. */
export function opcoesParcelas(total: number, parcelasMax: number, valorMinimoParcela: number | null): number[] {
  const opcoes = [1];
  for (let n = 2; n <= parcelasMax; n++) {
    if (valorMinimoParcela != null && total / n < valorMinimoParcela) break;
    if (total / n < VALOR_MINIMO_COBRANCA) break;
    opcoes.push(n);
  }
  return opcoes;
}
