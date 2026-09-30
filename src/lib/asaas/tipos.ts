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
