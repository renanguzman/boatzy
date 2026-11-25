import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { AsaasWebhookEventoStatus, Database, Json } from '@/types/supabase';
import { tratarEventoPagarme } from '@/lib/pagamentos/pagarme';
import type { PagarmeWebhookPayload } from './tipos';

/**
 * Fila de webhooks da Pagar.me (`pagarme_webhook_evento`) — mesmo desenho da
 * fila do Asaas (SPEC §34.4): o endpoint valida o Basic Auth, grava (idempotente
 * pelo `id` do hook), responde 200 e processa em `after()`; o cron reprocessa o
 * que ficou pendente, com erro ou travado.
 *
 * O handler nunca confia no corpo do webhook: reconsulta o pedido na API e
 * aplica o estado de lá (SPEC §109).
 */

export type EventoPagarmeRow = Database['public']['Tables']['pagarme_webhook_evento']['Row'];

/** Prefixos de evento tratados; os demais são gravados como `ignorado`. */
const PREFIXOS_TRATADOS = ['order.', 'charge.', 'chargeback.'];

export const MAX_TENTATIVAS_AUTOMATICAS = 8;
const MINUTOS_TRAVADO = 10;

/** Aceita só o formato mínimo de um webhook da Pagar.me. */
export function validarPayloadPagarme(corpo: unknown): PagarmeWebhookPayload | null {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return null;
  const { id, type } = corpo as Record<string, unknown>;
  if (typeof id !== 'string' || !id || id.length > 255) return null;
  if (typeof type !== 'string' || !/^[a-z_]+(\.[a-z_]+)+$/.test(type) || type.length > 80) return null;
  return corpo as PagarmeWebhookPayload;
}

function identificarRecurso(payload: PagarmeWebhookPayload): { tipo: string | null; id: string | null } {
  const id = payload.data && typeof payload.data.id === 'string' ? payload.data.id : null;
  return { tipo: payload.type.split('.')[0] ?? null, id };
}

function dataParaIso(d: string | undefined): string | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Grava o evento. Duplicata (mesmo `id`) é ignorada. Lança se o banco falhar (o endpoint responde 500). */
export async function registrarEventoPagarme(payload: PagarmeWebhookPayload): Promise<void> {
  const recurso = identificarRecurso(payload);
  const { error } = await supabaseAdmin.from('pagarme_webhook_evento').upsert(
    {
      id: payload.id,
      evento: payload.type,
      recurso_tipo: recurso.tipo,
      recurso_id: recurso.id,
      payload: payload as unknown as Json,
      criado_gateway_em: dataParaIso(payload.created_at),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw new Error(`Falha ao gravar evento ${payload.id}: ${error.message}`);
}

/** Processa um evento elegível (reserva atômica no banco). Devolve o status final ou `null`. */
export async function processarEventoPagarme(id: string): Promise<AsaasWebhookEventoStatus | null> {
  const { data, error } = await supabaseAdmin.rpc('pagarme_webhook_evento_reservar', {
    p_id: id,
    p_minutos_travado: MINUTOS_TRAVADO,
  });
  if (error) {
    console.error('[pagarme/eventos] falha ao reservar evento', id, error.message);
    return null;
  }
  const evento = data?.[0];
  if (!evento) return null;

  try {
    const tratado = PREFIXOS_TRATADOS.some((p) => evento.evento.startsWith(p));
    const resultado = tratado ? await tratarEventoPagarme(evento) : 'ignorado';
    await finalizar(id, { status: resultado, erro: null, processado_em: new Date().toISOString() });
    return resultado;
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[pagarme/eventos] handler falhou', evento.evento, id, mensagem);
    await finalizar(id, { status: 'erro', erro: mensagem.slice(0, 2000) });
    return 'erro';
  }
}

async function finalizar(
  id: string,
  campos: { status: AsaasWebhookEventoStatus; erro: string | null; processado_em?: string },
) {
  const { error } = await supabaseAdmin
    .from('pagarme_webhook_evento')
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'processando');
  if (error) console.error('[pagarme/eventos] falha ao finalizar evento', id, error.message);
}

export type ResumoReprocessamentoPagarme = { total: number; processados: number; ignorados: number; erros: number };

/** Rede de segurança do cron (sequencial, em ordem de chegada). */
export async function reprocessarPendentesPagarme(limite = 50): Promise<ResumoReprocessamentoPagarme> {
  const travadoAntesDe = new Date(Date.now() - MINUTOS_TRAVADO * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('pagarme_webhook_evento')
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
  if (error) throw new Error(`Falha ao listar eventos pendentes da Pagar.me: ${error.message}`);

  const resumo: ResumoReprocessamentoPagarme = { total: data.length, processados: 0, ignorados: 0, erros: 0 };
  for (const { id } of data) {
    const status = await processarEventoPagarme(id);
    if (status === 'processado') resumo.processados++;
    else if (status === 'ignorado') resumo.ignorados++;
    else if (status === 'erro') resumo.erros++;
  }
  return resumo;
}

/** Reprocessamento manual (admin): devolve `erro`/`ignorado` para a fila e processa na hora. */
export async function reprocessarEventoPagarmeManual(id: string): Promise<AsaasWebhookEventoStatus | null> {
  const { error } = await supabaseAdmin
    .from('pagarme_webhook_evento')
    .update({ status: 'pendente', atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['erro', 'ignorado']);
  if (error) throw new Error(`Falha ao reenfileirar evento: ${error.message}`);
  return processarEventoPagarme(id);
}
