/** Tipos das respostas da API v3 do Asaas usadas pelo Boatzy (só os campos que lemos). */

/** Envelope das listagens paginadas (`offset`/`limit`, máx. 100). */
export type AsaasLista<T> = {
  object: 'list';
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};

export type AsaasSaldo = { balance: number };

export type AsaasWebhookSendType = 'SEQUENTIALLY' | 'NON_SEQUENTIALLY';

/** Configuração de webhook cadastrada na conta Asaas (`/v3/webhooks`). */
export type AsaasWebhookConfig = {
  id: string;
  name: string;
  url: string;
  email: string;
  enabled: boolean;
  /** `true` = fila pausada pelo Asaas (15 falhas seguidas) — eventos ficam guardados por 14 dias. */
  interrupted: boolean;
  apiVersion: number;
  hasAuthToken: boolean;
  sendType: AsaasWebhookSendType;
  penalizedRequestsCount: number;
  events: string[];
};

/**
 * Corpo de um evento de webhook: `id` (único, chave de idempotência),
 * `event`, `dateCreated` (horário de Brasília, "AAAA-MM-DD HH:mm:ss") e um
 * objeto do recurso afetado (`payment`, `transfer`, …) cujo formato varia.
 */
export type AsaasEventoPayload = {
  id: string;
  event: string;
  dateCreated?: string;
  [recurso: string]: unknown;
};

/** Cliente (customer) do Asaas — `POST /customers`. */
export type AsaasCliente = { id: string; name: string; cpfCnpj: string | null; externalReference: string | null };

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';

/** Estorno dentro de `payment.refunds[]`. */
export type AsaasEstorno = {
  dateCreated?: string;
  status?: string; // PENDING | DONE | CANCELLED …
  value?: number;
  description?: string | null;
  transactionReceiptUrl?: string | null;
};

/**
 * Cobrança (payment) do Asaas — mesma forma na resposta da API e no objeto
 * `payment` dos webhooks. Só os campos que o Boatzy usa.
 */
export type AsaasCobranca = {
  id: string;
  customer: string;
  status: string; // PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED… (valor cru)
  billingType: AsaasBillingType;
  value: number;
  netValue?: number | null;
  dueDate?: string | null; // AAAA-MM-DD
  description?: string | null;
  externalReference?: string | null;
  invoiceUrl?: string | null;
  invoiceNumber?: string | null;
  transactionReceiptUrl?: string | null;
  installment?: string | null; // id do parcelamento
  installmentNumber?: number | null;
  confirmedDate?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  creditDate?: string | null;
  estimatedCreditDate?: string | null;
  pixTransaction?: string | null;
  deleted?: boolean;
  creditCard?: {
    creditCardNumber?: string | null; // só os 4 últimos dígitos
    creditCardBrand?: string | null;
    creditCardToken?: string | null;
  } | null;
  refunds?: AsaasEstorno[] | null;
};

/** `GET /payments/{id}/pixQrCode`. */
export type AsaasPixQrCode = {
  encodedImage: string; // PNG em base64
  payload: string; // copia-e-cola
  expirationDate?: string | null; // "AAAA-MM-DD HH:mm:ss" (horário de Brasília)
};

/** Chave Pix da conta (`/pix/addressKeys`). */
export type AsaasChavePix = {
  id: string;
  key: string;
  type: string; // EVP | CPF | CNPJ | EMAIL | PHONE
  status: string; // ACTIVE | AWAITING_ACTIVATION | AWAITING_DELETION | …
  dateCreated?: string;
  canBeDeleted?: boolean;
};
