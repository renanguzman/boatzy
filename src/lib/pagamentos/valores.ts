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

// ── Cobrança avulsa (SPEC §34.16) ───────────────────────────────────────────

export type ItemAvulso = { quantidade: number; valorUnitario: number };

/** Total de uma linha (quantidade × unitário), em centavos exatos. */
export function totalItemAvulso(item: ItemAvulso): number {
  return arredondarCentavos(item.quantidade * item.valorUnitario);
}

export type ValoresAvulso = ValoresPedido & {
  /** Soma das linhas. */
  valorCalculado: number;
  /** Total editado pelo gestor − soma das linhas (0 se não editou). */
  valorAjuste: number;
};

/**
 * Valores da cobrança avulsa. O gestor pode editar o total que recebe
 * (`valorFinal`); a diferença para a soma dos itens vira ajuste. A comissão
 * segue a regra do pedido da reserva (reais inteiros sobre o valor do gestor).
 */
export function calcularValoresAvulso(input: {
  itens: ItemAvulso[];
  valorFinal?: number | null;
  taxaPercent: number;
}): ValoresAvulso {
  const valorCalculado = arredondarCentavos(input.itens.reduce((s, i) => s + totalItemAvulso(i), 0));
  const valorItens = input.valorFinal != null ? arredondarCentavos(input.valorFinal) : valorCalculado;
  const v = calcularValoresPedido({
    precoUnitario: valorItens, multiplicador: 1, totalAdicionais: 0, taxaPercent: input.taxaPercent, descontoCupom: 0,
  });
  return { ...v, valorCalculado, valorAjuste: arredondarCentavos(valorItens - valorCalculado) };
}

/**
 * Linhas da cobrança avulsa como o CLIENTE vê: a taxa de serviço distribuída
 * proporcionalmente (o site nunca mostra a taxa em linha própria). O ajuste do
 * gestor vira uma linha a mais; o arredondamento vai para a última linha, para
 * a soma bater exatamente com o total.
 */
export function linhasAvulsoParaCliente(input: {
  itens: number[]; // total de cada linha (valor do gestor)
  valorAjuste: number;
  valorItens: number;
  valorTotal: number;
}): { itens: number[]; ajuste: number } {
  const fator = input.valorItens > 0 ? input.valorTotal / input.valorItens : 1;
  const itens = input.itens.map((v) => arredondarCentavos(v * fator));
  let ajuste = input.valorAjuste !== 0 ? arredondarCentavos(input.valorAjuste * fator) : 0;
  const diferenca = arredondarCentavos(input.valorTotal - itens.reduce((s, v) => s + v, 0) - ajuste);
  if (diferenca !== 0) {
    if (ajuste !== 0) ajuste = arredondarCentavos(ajuste + diferenca);
    else if (itens.length) itens[itens.length - 1] = arredondarCentavos(itens[itens.length - 1] + diferenca);
  }
  return { itens, ajuste };
}

// ── Juros do parcelamento no cartão (Pagar.me, SPEC §109) ───────────────────
// D-S5: os juros do parcelado são 100% pagos pelo cliente. À vista (1x) não tem
// juros. O admin cadastra o acréscimo (%) de cada nº de parcelas sobre o valor à
// vista (Financeiro → Configurações). Comissão, cupom e valor do gestor não mudam.

/** nº de parcelas → acréscimo (%) sobre o valor à vista. Ausente = 0. */
export type TabelaJuros = Record<number, number>;

export type ValorParcelado = {
  parcelas: number;
  /** Acréscimo aplicado (%). */
  percentual: number;
  /** Juros em R$ (o que o cliente paga a mais). */
  juros: number;
  /** Total cobrado no cartão (= valor à vista + juros). */
  total: number;
  /** Valor de cada parcela (a 1ª absorve a diferença de centavos). */
  parcela: number;
};

export function valorParcelado(valorAVista: number, parcelas: number, tabela: TabelaJuros | null): ValorParcelado {
  const n = Math.max(1, Math.trunc(parcelas) || 1);
  const percentual = n > 1 && tabela ? Math.max(0, Number(tabela[n] ?? 0)) : 0;
  const juros = arredondarCentavos(valorAVista * (percentual / 100));
  const total = arredondarCentavos(valorAVista + juros);
  return { parcelas: n, percentual, juros, total, parcela: arredondarCentavos(Math.floor((total / n) * 100) / 100) };
}
