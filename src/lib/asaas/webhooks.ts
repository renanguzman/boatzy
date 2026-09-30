import 'server-only';

import { asaasRequest } from './client';
import type { AsaasLista, AsaasWebhookConfig } from './tipos';

/**
 * Eventos que o Boatzy assina no webhook. Os que ainda não têm handler são
 * gravados como `ignorado` e podem ser reprocessados quando a fase que os
 * trata entrar no ar (ver `eventos.ts`).
 */
export const EVENTOS_ASSINADOS = [
  // Cobranças
  'PAYMENT_AUTHORIZED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_ANTICIPATED',
  'PAYMENT_UPDATED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  // Transferências (repasses)
  'TRANSFER_CREATED',
  'TRANSFER_PENDING',
  'TRANSFER_IN_BANK_PROCESSING',
  'TRANSFER_BLOCKED',
  'TRANSFER_DONE',
  'TRANSFER_FAILED',
  'TRANSFER_CANCELLED',
] as const;

/** Webhooks cadastrados na conta (normalmente 1 ou 2 — uma página de 100 basta). */
export async function listarWebhooks(): Promise<AsaasWebhookConfig[]> {
  const lista = await asaasRequest<AsaasLista<AsaasWebhookConfig>>('/webhooks', { query: { limit: 100 } });
  return lista.data ?? [];
}

/**
 * Cadastra o webhook do Boatzy: fila sequencial (preserva a ordem dos
 * eventos) e o nosso token no header `asaas-access-token`.
 */
export async function criarWebhook(input: { url: string; email: string; authToken: string }): Promise<AsaasWebhookConfig> {
  return asaasRequest<AsaasWebhookConfig>('/webhooks', {
    metodo: 'POST',
    corpo: {
      name: 'Boatzy',
      url: input.url,
      email: input.email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: input.authToken,
      sendType: 'SEQUENTIALLY',
      events: EVENTOS_ASSINADOS,
    },
  });
}

/** Retoma uma fila pausada pelo Asaas. Só faça depois de corrigir a causa das falhas. */
export async function reativarFilaWebhook(id: string): Promise<AsaasWebhookConfig> {
  return asaasRequest<AsaasWebhookConfig>(`/webhooks/${encodeURIComponent(id)}`, {
    metodo: 'PUT',
    corpo: { interrupted: false },
  });
}
