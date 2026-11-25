import 'server-only';

import { PagarmeError, pagarmeRequest } from './client';
import type { PagarmeCliente, PagarmeCobranca, PagarmeEndereco, PagarmeLista, PagarmePedido } from './tipos';

/** Nome na fatura do cartão (máx. 13 caracteres no PSP, 22 no gateway — fica no menor). */
export const DESCRITOR_FATURA = 'BOATZY';

export type CriarPedidoCartaoInput = {
  /** id do `pagamento` no Boatzy — chave para recuperar o pedido após um timeout. */
  code: string;
  descricao: string;
  /** Código do item (nº do pedido Boatzy). */
  itemCodigo: string;
  /** Valor total cobrado (com juros), em centavos. */
  valorCentavos: number;
  parcelas: number;
  cardToken: string;
  cliente: PagarmeCliente;
  enderecoCobranca: PagarmeEndereco;
  metadata?: Record<string, string>;
};

/**
 * Cria o pedido com o cartão tokenizado no navegador (checkout transparente,
 * conta Gateway → `card_token`). A resposta já traz o resultado da autorização
 * em `charges[0].last_transaction`. Captura na hora (`auth_and_capture`).
 */
export async function criarPedidoCartao(input: CriarPedidoCartaoInput): Promise<PagarmePedido> {
  return pagarmeRequest<PagarmePedido>('/orders', {
    metodo: 'POST',
    timeoutMs: 40_000, // autorização + antifraude podem demorar
    corpo: {
      code: input.code,
      closed: true,
      items: [{ code: input.itemCodigo, description: input.descricao.slice(0, 256), amount: input.valorCentavos, quantity: 1 }],
      customer: input.cliente,
      payments: [
        {
          payment_method: 'credit_card',
          amount: input.valorCentavos,
          credit_card: {
            installments: input.parcelas,
            statement_descriptor: DESCRITOR_FATURA,
            operation_type: 'auth_and_capture',
            card_token: input.cardToken,
            card: { billing_address: input.enderecoCobranca },
          },
        },
      ],
      metadata: input.metadata,
    },
  });
}

export async function consultarPedido(id: string): Promise<PagarmePedido> {
  return pagarmeRequest<PagarmePedido>(`/orders/${encodeURIComponent(id)}`);
}

export async function consultarCobranca(id: string): Promise<PagarmeCobranca> {
  return pagarmeRequest<PagarmeCobranca>(`/charges/${encodeURIComponent(id)}`);
}

/**
 * Procura o pedido criado para um `pagamento` do Boatzy (`code`). Usado quando a
 * criação deu timeout: consultar ANTES de desistir evita cobrança duplicada.
 */
export async function buscarPedidoPorCode(code: string): Promise<PagarmePedido | null> {
  const lista = await pagarmeRequest<PagarmeLista<PagarmePedido>>('/orders', { query: { code, size: 5 } });
  const pedido = (lista.data ?? []).find((p) => p.code === code);
  // A listagem pode vir resumida — o detalhe traz as cobranças com a última transação.
  return pedido ? consultarPedido(pedido.id) : null;
}

/**
 * Cancela/estorna uma cobrança (`DELETE /charges/{id}`). Sem `valorCentavos` = total;
 * com valor = estorno parcial. Cobrança que não existe (404) é erro (o admin precisa saber).
 */
export async function estornarCobranca(chargeId: string, valorCentavos?: number): Promise<PagarmeCobranca> {
  return pagarmeRequest<PagarmeCobranca>(`/charges/${encodeURIComponent(chargeId)}`, {
    metodo: 'DELETE',
    corpo: valorCentavos ? { amount: valorCentavos } : {},
  });
}

/** Chamada leve para validar a chave (admin → Integração). */
export async function testarConexao(): Promise<void> {
  await pagarmeRequest<PagarmeLista<PagarmePedido>>('/orders', { query: { size: 1 } });
}

export { PagarmeError };
