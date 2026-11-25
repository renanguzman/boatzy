/**
 * Tipos da API v5 da Pagar.me usados pelo Boatzy (SPEC §109). Só os campos que
 * lemos — a API devolve mais. Valores em centavos.
 */

export type PagarmeCartao = {
  id?: string;
  first_six_digits?: string;
  last_four_digits?: string;
  brand?: string;
  holder_name?: string;
};

export type PagarmeTransacao = {
  id: string;                         // tran_…
  transaction_type?: string;          // credit_card
  status: string;                     // captured, authorized_pending_capture, not_authorized, refunded, voided, partial_refunded, with_error, failed…
  success?: boolean;
  amount?: number;
  installments?: number;
  operation_type?: string;
  acquirer_name?: string;
  acquirer_tid?: string;
  acquirer_nsu?: string;
  acquirer_auth_code?: string;
  acquirer_message?: string;
  acquirer_return_code?: string;
  card?: PagarmeCartao;
  antifraud_response?: { status?: string; return_code?: string; return_message?: string } | null;
  gateway_response?: { code?: string; errors?: { message?: string }[] } | null;
  created_at?: string;
  updated_at?: string;
};

export type PagarmeCobranca = {
  id: string;                         // ch_…
  code?: string;
  amount: number;
  paid_amount?: number;
  canceled_amount?: number;
  status: string;                     // pending, processing, paid, failed, canceled, chargedback, overpaid, underpaid
  payment_method?: string;            // credit_card
  paid_at?: string | null;
  canceled_at?: string | null;
  created_at?: string;
  order?: { id: string; code?: string } | null;
  customer?: { id: string } | null;
  last_transaction?: PagarmeTransacao | null;
};

export type PagarmePedido = {
  id: string;                         // or_…
  code: string;                       // id do `pagamento` no Boatzy
  amount: number;
  currency?: string;
  status: string;                     // pending, paid, canceled, failed
  closed?: boolean;
  customer?: { id: string } | null;
  charges?: PagarmeCobranca[];
  created_at?: string;
  updated_at?: string;
};

export type PagarmeLista<T> = { data: T[]; paging?: { total?: number; next?: string; previous?: string } };

/** Corpo de um webhook (`type` = evento, `data` = o objeto afetado). */
export type PagarmeWebhookPayload = {
  id: string;                         // hook_…
  type: string;                       // order.paid, charge.paid, charge.refunded, chargeback.received…
  created_at?: string;
  account?: { id?: string; name?: string };
  data?: Record<string, unknown>;
};

/** Endereço no formato da v5 (`line_1` = "número, rua, bairro"). */
export type PagarmeEndereco = {
  line_1: string;
  line_2?: string;
  zip_code: string;
  city: string;
  state: string;
  country: string;                    // ISO 3166-1 alfa-2
};

export type PagarmeTelefone = { country_code: string; area_code: string; number: string };

export type PagarmeCliente = {
  name: string;
  email: string;
  code?: string;
  type: 'individual' | 'company';
  document: string;
  document_type: 'CPF' | 'CNPJ' | 'PASSPORT';
  address?: PagarmeEndereco;
  phones?: { mobile_phone?: PagarmeTelefone };
};
