import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { AsaasWebhookEventoStatus, Database, Json } from '@/types/supabase';
import { tratarEventoCobranca } from '@/lib/pagamentos/webhook';
import type { AsaasEventoPayload } from './tipos';
import { EVENTOS_ASSINADOS } from './webhooks';

/**
 * Fila de eventos de webhook do Asaas (`asaas_webhook_evento`).
 *
 * Fluxo: o endpoint valida o token e chama `registrarEvento` (idempotente
 * pelo `id` do evento) → responde 200 → `processarEvento` roda em `after()`.
 * O cron `/api/cron/asaas-webhooks` chama `reprocessarPendentes` como rede de
 * segurança (processamento que caiu, handler que falhou).
 */

export type EventoAsaasRow = Database['public']['Tables']['asaas_webhook_evento']['Row'];

/**
 * Trata um tipo de evento. Precisa ser idempotente também no negócio
 * (transições guardadas, ex.: `UPDATE … WHERE status = 'aguardando_pagamento'`),
 * porque o mesmo evento pode ser processado de novo após uma falha.
 * Retorne `'ignorado'` quando o evento não se aplica (ex.: cobrança que não é
 * de reserva). Lançar erro marca o evento como `erro` para nova tentativa.
 */
export type HandlerEventoAsaas = (evento: EventoAsaasRow) => Promise<'processado' | 'ignorado' | void>;

/**
 * Handlers por tipo de evento. Fase 1: todos os `PAYMENT_*` assinados →
 * `tratarEventoCobranca` (cobranças que não são do checkout do Boatzy saem
 * como `ignorado`). A Fase 3 registra os `TRANSFER_*`. Eventos sem handler são
 * gravados e marcados como `ignorado`.
 */
const HANDLERS: Partial<Record<string, HandlerEventoAsaas>> = Object.fromEntries(
  EVENTOS_ASSINADOS.filter((e) => e.startsWith('PAYMENT_')).map((e) => [e, tratarEventoCobranca]),
);

/** Acima disso o cron para de tentar; o evento fica em `erro` até o admin reprocessar. */
export const MAX_TENTATIVAS_AUTOMATICAS = 8;

/** Minutos para considerar um `processando` como travado (processador caiu no meio). */
const MINUTOS_TRAVADO = 10;

const CHAVES_FIXAS = new Set(['id', 'event', 'dateCreated', 'account']);

/**
 * Objetos de recurso em ordem de preferência. O payload também traz `account`
 * (a conta que gerou o evento), que nunca é o recurso afetado.
 */
const RECURSOS_CONHECIDOS = ['payment', 'transfer', 'anticipation', 'subscription', 'invoice', 'bill', 'pixTransaction'];

/** Aceita só o formato mínimo de um evento do Asaas; qualquer outra coisa é rejeitada. */
export function validarPayloadEvento(corpo: unknown): AsaasEventoPayload | null {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return null;
  const { id, event } = corpo as Record<string, unknown>;
  if (typeof id !== 'string' || !id || id.length > 255) return null;
  if (typeof event !== 'string' || !/^[A-Z_]{3,80}$/.test(event)) return null;
  return corpo as AsaasEventoPayload;
}

/** Descobre o objeto afetado pelo evento (`payment`, `transfer`, …) e o id dele. */
function identificarRecurso(payload: AsaasEventoPayload): { tipo: string | null; id: string | null } {
  const conhecida = RECURSOS_CONHECIDOS.find((c) => payload[c] && typeof payload[c] === 'object');
  const chave =
    conhecida ??
    Object.keys(payload).find((c) => !CHAVES_FIXAS.has(c) && !!payload[c] && typeof payload[c] === 'object');
  if (!chave) return { tipo: null, id: null };
  const id = (payload[chave] as Record<string, unknown>).id;
  return { tipo: chave, id: typeof id === 'string' ? id : null };
}

/** `dateCreated` vem como "AAAA-MM-DD HH:mm:ss" no horário de Brasília (sem horário de verão desde 2019). */
function dataAsaasParaIso(data: string | undefined): string | null {
  if (!data || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(data)) return null;
  return `${data.replace(' ', 'T')}-03:00`;
}

/**
 * Grava o evento na fila. Duplicatas (mesmo `id`) são ignoradas em silêncio.
 * Lança erro se o banco falhar — o endpoint então responde 500 e o Asaas
 * reenvia depois.
 */
export async function registrarEvento(payload: AsaasEventoPayload): Promise<void> {
  const recurso = identificarRecurso(payload);
  const { error } = await supabaseAdmin.from('asaas_webhook_evento').upsert(
    {
      id: payload.id,
      evento: payload.event,
      recurso_tipo: recurso.tipo,
      recurso_id: recurso.id,
      payload: payload as unknown as Json,
      criado_asaas_em: dataAsaasParaIso(payload.dateCreated),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw new Error(`Falha ao gravar evento ${payload.id}: ${error.message}`);
}

/**
 * Processa um evento, se ele estiver elegível (pendente, com erro ou travado).
 * A reserva do evento é atômica no banco — chamadas concorrentes para o mesmo
 * id processam uma vez só. Devolve o status final, ou `null` se não processou.
 */
export async function processarEvento(id: string): Promise<AsaasWebhookEventoStatus | null> {
  const { data, error } = await supabaseAdmin.rpc('asaas_webhook_evento_reservar', {
    p_id: id,
    p_minutos_travado: MINUTOS_TRAVADO,
  });
  if (error) {
    console.error('[asaas/eventos] falha ao reservar evento', id, error.message);
    return null;
  }
  const evento = data?.[0];
  if (!evento) return null;

  const handler = HANDLERS[evento.evento];
  try {
    const resultado = handler ? ((await handler(evento)) ?? 'processado') : 'ignorado';
    await finalizar(id, { status: resultado, erro: null, processado_em: new Date().toISOString() });
    return resultado;
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[asaas/eventos] handler falhou', evento.evento, id, mensagem);
    await finalizar(id, { status: 'erro', erro: mensagem.slice(0, 2000) });
    return 'erro';
  }
}

async function finalizar(
  id: string,
  campos: { status: AsaasWebhookEventoStatus; erro: string | null; processado_em?: string },
) {
  const { error } = await supabaseAdmin
    .from('asaas_webhook_evento')
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'processando');
  // Se falhar, o evento fica em `processando` e volta a ser elegível após MINUTOS_TRAVADO.
  if (error) console.error('[asaas/eventos] falha ao finalizar evento', id, error.message);
}

export type ResumoReprocessamento = {
  total: number;
  processados: number;
  ignorados: number;
  erros: number;
};

/**
 * Rede de segurança do cron: processa, em ordem de chegada, os eventos
 * pendentes, com erro (abaixo do limite de tentativas) ou travados.
 * Sequencial de propósito — preserva a ordem e não estoura o limite da API.
 */
export async function reprocessarPendentes(limite = 50): Promise<ResumoReprocessamento> {
  const travadoAntesDe = new Date(Date.now() - MINUTOS_TRAVADO * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('asaas_webhook_evento')
    .select('id')
    .or(
      [
        'status.eq.pendente',
        `and(status.eq.erro,tentativas.lt.${MAX_TENTATIVAS_AUTOMATICAS})`,
        `and(status.eq.processando,atualizado_em.lt.${travadoAntesDe})`,
      ].join(','),
    )
    .order('recebido_em', { ascending: true })
    .limit(limite);
  if (error) throw new Error(`Falha ao listar eventos pendentes: ${error.message}`);

  const resumo: ResumoReprocessamento = { total: data.length, processados: 0, ignorados: 0, erros: 0 };
  for (const { id } of data) {
    const status = await processarEvento(id);
    if (status === 'processado') resumo.processados++;
    else if (status === 'ignorado') resumo.ignorados++;
    else if (status === 'erro') resumo.erros++;
  }
  return resumo;
}

/**
 * Reprocessamento manual (admin): devolve um evento `erro` ou `ignorado`
 * para a fila e processa na hora — ignora o limite de tentativas do cron.
 * Eventos `processado` não são reprocessados.
 */
export async function reprocessarEventoManual(id: string): Promise<AsaasWebhookEventoStatus | null> {
  const { error } = await supabaseAdmin
    .from('asaas_webhook_evento')
    .update({ status: 'pendente', atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['erro', 'ignorado']);
  if (error) throw new Error(`Falha ao reenfileirar evento: ${error.message}`);
  return processarEvento(id);
}
