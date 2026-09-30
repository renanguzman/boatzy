import 'server-only';

import { AsaasError, asaasRequest } from './client';
import type { AsaasBillingType, AsaasCobranca, AsaasLista, AsaasPixQrCode } from './tipos';

export type CriarCobrancaInput = {
  customer: string;
  billingType: Extract<AsaasBillingType, 'PIX' | 'CREDIT_CARD'>;
  valorTotal: number;
  parcelas: number; // 1 = à vista
  vencimento: string; // AAAA-MM-DD
  descricao: string;
  externalReference: string; // id do `pagamento` no Boatzy
  /** Página para onde a fatura do Asaas manda o cliente depois de pagar (cartão). */
  urlRetorno?: string;
};

function corpoCobranca(input: CriarCobrancaInput, comRetorno: boolean) {
  return {
    customer: input.customer,
    billingType: input.billingType,
    dueDate: input.vencimento,
    description: input.descricao.slice(0, 500),
    externalReference: input.externalReference,
    ...(input.parcelas > 1
      ? { installmentCount: input.parcelas, totalValue: input.valorTotal }
      : { value: input.valorTotal }),
    ...(comRetorno && input.urlRetorno ? { callback: { successUrl: input.urlRetorno, autoRedirect: true } } : {}),
  };
}

/** Erros de validação ligados ao `callback` (ex.: domínio não cadastrado nas informações comerciais da conta). */
function erroDeCallback(err: unknown): boolean {
  if (!(err instanceof AsaasError) || err.status !== 400) return false;
  const texto = `${err.message} ${err.codigo ?? ''}`.toLowerCase();
  return /callback|successurl|dom[ií]nio|url de sucesso/.test(texto);
}

/**
 * Cria a cobrança. Parcelado: `installmentCount` + `totalValue` (o Asaas
 * divide) — a resposta é a 1ª parcela, com `installment` preenchido.
 *
 * O retorno automático para o site (`callback.successUrl`) exige que o domínio
 * esteja cadastrado em Configurações da conta → Informações no Asaas. Se não
 * estiver, a cobrança é criada sem o retorno (a fatura mostra "Ir para o site")
 * em vez de falhar.
 */
export async function criarCobranca(input: CriarCobrancaInput): Promise<AsaasCobranca> {
  try {
    return await asaasRequest<AsaasCobranca>('/payments', { metodo: 'POST', corpo: corpoCobranca(input, true) });
  } catch (err) {
    if (!input.urlRetorno || !erroDeCallback(err)) throw err;
    console.warn('[asaas/cobrancas] callback recusado — criando sem retorno automático:', (err as Error).message);
    return asaasRequest<AsaasCobranca>('/payments', { metodo: 'POST', corpo: corpoCobranca(input, false) });
  }
}

export async function consultarCobranca(id: string): Promise<AsaasCobranca> {
  return asaasRequest<AsaasCobranca>(`/payments/${encodeURIComponent(id)}`);
}

/**
 * Procura a cobrança criada para um `pagamento` do Boatzy — usada quando a
 * criação deu timeout: consultar ANTES de tentar de novo evita cobrança
 * duplicada. Ignora cobranças removidas.
 */
export async function buscarCobrancaPorReferencia(externalReference: string): Promise<AsaasCobranca | null> {
  const lista = await asaasRequest<AsaasLista<AsaasCobranca>>('/payments', {
    query: { externalReference, limit: 10 },
  });
  const ativas = (lista.data ?? []).filter((c) => !c.deleted);
  // Parcelado: todas as parcelas têm a mesma referência — a 1ª representa a cobrança.
  return ativas.sort((a, b) => (a.installmentNumber ?? 1) - (b.installmentNumber ?? 1))[0] ?? null;
}

/**
 * Remove uma cobrança pendente (ex.: pedido expirou, cliente trocou a forma de
 * pagamento). Cobrança que já não existe (404) conta como removida.
 * Parcelado: remove o parcelamento inteiro.
 */
export async function removerCobranca(input: { paymentId: string; parcelamentoId?: string | null }): Promise<void> {
  const caminho = input.parcelamentoId
    ? `/installments/${encodeURIComponent(input.parcelamentoId)}`
    : `/payments/${encodeURIComponent(input.paymentId)}`;
  try {
    await asaasRequest<unknown>(caminho, { metodo: 'DELETE' });
  } catch (err) {
    if (err instanceof AsaasError && err.status === 404) return;
    throw err;
  }
}

/** QR Code dinâmico da cobrança Pix (imagem base64 + copia-e-cola). */
export async function obterQrCodePix(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
}

/** Todas as parcelas (cobranças) de um parcelamento — `GET /payments?installment=…`. */
export async function listarCobrancasDoParcelamento(parcelamentoId: string): Promise<AsaasCobranca[]> {
  const lista = await asaasRequest<AsaasLista<AsaasCobranca>>('/payments', {
    query: { installment: parcelamentoId, limit: 100 },
  });
  return lista.data ?? [];
}
