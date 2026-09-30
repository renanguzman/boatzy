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
