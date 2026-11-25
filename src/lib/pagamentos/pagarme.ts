import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Database, Json, PagamentoStatus } from '@/types/supabase';
import { consultarCobranca, consultarPedido } from '@/lib/pagarme/pedidos';
import { PagarmeError } from '@/lib/pagarme/client';
import type { PagarmeCobranca, PagarmePedido, PagarmeWebhookPayload } from '@/lib/pagarme/tipos';
import type { EventoPagarmeRow } from '@/lib/pagarme/eventos';
import { aplicarEfeitosNoPedido } from './webhook';

/**
 * Estado da Pagar.me (cartão) → `pagamento` do Boatzy (SPEC §109). Usado pela
 * resposta síncrona do checkout, pelo webhook (sempre reconsultando a API) e
 * pela sincronização do admin. Idempotente.
 *
 * `recebido` (liquidado) não vem daqui: depende da liquidação da Stone
 * (antecipação automática) — Fase 4, ver docs/planejamento-pagamentos-stone.md §2.1.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tipo do movimento em `pagamento_transacao` a partir do evento. */
const TIPO_TRANSACAO: Record<string, string> = {
  'order.created': 'criacao',
  'charge.created': 'criacao',
  'order.paid': 'confirmacao',
  'charge.paid': 'confirmacao',
  'order.payment_failed': 'recusa',
  'charge.payment_failed': 'recusa',
  'order.canceled': 'cancelamento',
  'charge.refunded': 'estorno',
  'charge.partial_canceled': 'estorno_parcial',
  'chargeback.received': 'chargeback',
  'charge.chargedback': 'chargeback',
  'charge.antifraud_approved': 'aprovado_analise_risco',
  'charge.antifraud_reproved': 'recusa',
  'charge.antifraud_manual': 'analise_risco',
  'charge.antifraud_pending': 'analise_risco',
  'charge.processing': 'analise_risco',
};

const FALHA_TRANSACAO = new Set(['not_authorized', 'with_error', 'failed']);

/** Status normalizado a partir da cobrança (e do evento, quando há). */
export function statusDaCobrancaPagarme(c: PagarmeCobranca, evento: string | null): PagamentoStatus | null {
  if (evento === 'chargeback.received' || evento === 'charge.chargedback' || c.status === 'chargedback') return 'em_disputa';
  const tx = c.last_transaction?.status ?? '';
  const cancelado = Number(c.canceled_amount ?? 0);
  if (tx === 'partial_refunded' || (c.status === 'paid' && cancelado > 0 && cancelado < Number(c.amount))) return 'estornado_parcial';
  if (tx === 'refunded') return 'estornado';
  switch (c.status) {
    case 'paid':
    case 'overpaid':
    case 'underpaid':
      return 'confirmado';
    case 'pending':
    case 'processing':
      return 'em_analise';
    case 'failed':
      return 'recusado';
    case 'canceled':
      if (c.paid_at || Number(c.paid_amount ?? 0) > 0) return 'estornado';
      return FALHA_TRANSACAO.has(tx) ? 'recusado' : 'cancelado';
  }
  if (tx === 'captured') return 'confirmado';
  if (FALHA_TRANSACAO.has(tx)) return 'recusado';
  return null;
}

const PAGO: PagamentoStatus[] = ['confirmado', 'recebido'];

/**
 * Transições aceitas. Webhooks chegam fora de ordem: depois de capturado, um
 * evento atrasado de análise/recusa não desfaz o pago; estorno e disputa não
 * voltam para "pago".
 */
function podeTransitar(atual: PagamentoStatus, novo: PagamentoStatus): boolean {
  if (atual === novo) return true;
  if (PAGO.includes(atual) && ['pendente', 'em_analise', 'recusado', 'cancelado', 'vencido'].includes(novo)) return false;
  if (atual === 'recebido' && novo === 'confirmado') return false;
  if (atual === 'estornado') return novo === 'em_disputa';
  if (['estornado_parcial', 'em_disputa'].includes(atual) && ['pendente', 'em_analise', 'confirmado', 'recusado', 'cancelado'].includes(novo)) {
    return false;
  }
  if (['recusado', 'cancelado'].includes(atual) && ['pendente', 'em_analise'].includes(novo)) return false;
  return true;
}

/** A cobrança de cartão do pedido (o Boatzy cria uma só). */
export function cobrancaDoPedido(p: PagarmePedido): PagarmeCobranca | null {
  const cobrancas = p.charges ?? [];
  return cobrancas.find((c) => c.payment_method === 'credit_card') ?? cobrancas[0] ?? null;
}

/** Motivo da recusa para a mensagem ao cliente (`Pagamento.cartao.recusa.*`). */
export type MotivoRecusa = 'antifraude' | 'saldo' | 'vencido' | 'dados' | 'cvv' | 'naoPermitido' | 'generico';

export function motivoRecusa(c: PagarmeCobranca | null): MotivoRecusa {
  const tx = c?.last_transaction;
  const antifraude = tx?.antifraud_response?.status?.toLowerCase();
  if (antifraude === 'reproved' || antifraude === 'denied') return 'antifraude';
  // Códigos de retorno da adquirente (padrão ABECS).
  const codigo = (tx?.acquirer_return_code ?? '').toUpperCase();
  if (['51', '116'].includes(codigo)) return 'saldo';
  if (['54', '101'].includes(codigo)) return 'vencido';
  if (['14', '56', '111', '1011'].includes(codigo)) return 'dados';
  if (['82', 'N7', '63', '1045'].includes(codigo)) return 'cvv';
  if (['57', '58', '62', '78'].includes(codigo)) return 'naoPermitido';
  return 'generico';
}

export type ContextoPagarme = {
  evento: string | null;
  eventoId: string | null;
  ocorridoEm: string | null;
  /** checkout = resposta síncrona; webhook; sincronizacao = admin. */
  origem: 'checkout' | 'webhook' | 'sincronizacao';
};

export type ResultadoPagarme = {
  resultado: 'processado' | 'ignorado';
  pagamentoId?: string;
  pedidoId?: string;
  statusAnterior?: PagamentoStatus;
  statusNovo?: PagamentoStatus;
  cobranca?: PagarmeCobranca | null;
};

async function localizarPagamento(p: PagarmePedido) {
  const campos = 'id, pedido_id, status';
  const porPedido = await supabaseAdmin.from('pagamento').select(campos).eq('gateway_pedido_id', p.id).maybeSingle();
  if (porPedido.data) return porPedido.data;
  if (p.code && UUID.test(p.code)) {
    const porCode = await supabaseAdmin.from('pagamento').select(campos).eq('id', p.code).eq('gateway', 'pagarme').maybeSingle();
    if (porCode.data) return porCode.data;
  }
  return null;
}

/** Aplica o estado de um pedido da Pagar.me ao pagamento correspondente e os efeitos no pedido/reserva. */
export async function aplicarPedidoPagarme(p: PagarmePedido, ctx: ContextoPagarme): Promise<ResultadoPagarme> {
  const pagamento = await localizarPagamento(p);
  if (!pagamento) return { resultado: 'ignorado' }; // pedido criado fora do checkout do Boatzy

  const cobranca = cobrancaDoPedido(p);
  const tx = cobranca?.last_transaction ?? null;
  const novoStatus = cobranca ? statusDaCobrancaPagarme(cobranca, ctx.evento) : null;
  const statusAnterior = pagamento.status as PagamentoStatus;
  let statusAplicado = statusAnterior;

  const atualizacao: Database['public']['Tables']['pagamento']['Update'] = {
    gateway_pedido_id: p.id,
    gateway_cobranca_id: cobranca?.id ?? undefined,
    gateway_customer_id: p.customer?.id ?? cobranca?.customer?.id ?? undefined,
    status_gateway: cobranca ? `${cobranca.status}${tx?.status ? `/${tx.status}` : ''}` : p.status,
    ultimo_payload: p as unknown as Json,
  };
  if (novoStatus && podeTransitar(statusAnterior, novoStatus)) {
    atualizacao.status = novoStatus;
    statusAplicado = novoStatus;
    if (novoStatus === 'confirmado' && !PAGO.includes(statusAnterior)) {
      atualizacao.confirmado_em = cobranca?.paid_at ?? new Date().toISOString();
    }
  }
  await supabaseAdmin.from('pagamento').update(atualizacao).eq('id', pagamento.id);

  // Cartão: bandeira, 4 últimos dígitos e dados da adquirente (nunca o número completo).
  const final = tx?.card?.last_four_digits ?? null;
  const bandeira = tx?.card?.brand?.toUpperCase().replace(/[^A-Z_]/g, '_') ?? null;
  if (final && /^\d{4}$/.test(final) && bandeira && /^[A-Z_]{2,30}$/.test(bandeira)) {
    const corte = (v: string | undefined | null, max = 120) => (v ? String(v).slice(0, max) : null);
    await supabaseAdmin.from('pagamento_cartao').upsert(
      {
        pagamento_id: pagamento.id,
        bandeira,
        ultimos_digitos: final,
        nome_portador: corte(tx?.card?.holder_name),
        adquirente: corte(tx?.acquirer_name, 60),
        adquirente_nsu: corte(tx?.acquirer_nsu, 60),
        adquirente_tid: corte(tx?.acquirer_tid, 60),
        codigo_autorizacao: corte(tx?.acquirer_auth_code, 60),
        codigo_retorno: corte(tx?.acquirer_return_code, 20),
        mensagem_retorno: corte(tx?.acquirer_message, 255),
      },
      { onConflict: 'pagamento_id' },
    );
  }

  // Histórico de movimentos: 1 linha por evento; no checkout, o resultado da autorização.
  const valorCobranca = cobranca ? Number(cobranca.amount) / 100 : Number(p.amount) / 100;
  if (ctx.origem === 'webhook' && ctx.evento && ctx.eventoId) {
    await supabaseAdmin.from('pagamento_transacao').upsert(
      {
        pagamento_id: pagamento.id,
        gateway: 'pagarme',
        tipo: TIPO_TRANSACAO[ctx.evento] ?? ctx.evento.replace(/[^a-z]+/g, '_'),
        status_gateway: atualizacao.status_gateway ?? null,
        valor: valorCobranca,
        ocorrido_em: ctx.ocorridoEm ?? new Date().toISOString(),
        gateway_evento_id: ctx.eventoId,
        payload: cobranca as unknown as Json,
      },
      { onConflict: 'gateway_evento_id', ignoreDuplicates: true },
    );
  } else if (ctx.origem === 'checkout') {
    await supabaseAdmin.from('pagamento_transacao').insert({
      pagamento_id: pagamento.id,
      gateway: 'pagarme',
      tipo: novoStatus === 'confirmado' ? 'autorizacao' : novoStatus === 'recusado' ? 'recusa' : 'analise_risco',
      status_gateway: atualizacao.status_gateway ?? null,
      valor: valorCobranca,
      payload: cobranca as unknown as Json,
    });
  }

  await aplicarEfeitosNoPedido({
    pagamentoId: pagamento.id,
    pedidoId: pagamento.pedido_id,
    // Só o status de fato aplicado gera efeito (transição barrada não confirma nem estorna o pedido).
    novoStatus: novoStatus && statusAplicado === novoStatus ? novoStatus : null,
    statusAnterior,
    statusAplicado,
    // Recusa síncrona aparece na tela; e-mail só na recusa assíncrona (antifraude depois da análise).
    avisarRecusa: ctx.origem === 'webhook',
  });

  return {
    resultado: 'processado', pagamentoId: pagamento.id, pedidoId: pagamento.pedido_id,
    statusAnterior, statusNovo: statusAplicado, cobranca,
  };
}

/** Ids do pedido e da cobrança citados no webhook (`data` = pedido, cobrança ou chargeback). */
function idsDoWebhook(data: Record<string, unknown>): { pedidoId: string | null; cobrancaId: string | null } {
  const id = typeof data.id === 'string' ? data.id : null;
  const order = data.order && typeof data.order === 'object' ? (data.order as { id?: unknown }).id : null;
  const charge = data.charge && typeof data.charge === 'object' ? (data.charge as { id?: unknown }).id : null;
  return {
    pedidoId: id?.startsWith('or_') ? id : typeof order === 'string' ? order : null,
    cobrancaId: id?.startsWith('ch_') ? id : typeof charge === 'string' ? charge : null,
  };
}

/** Handler da fila (`src/lib/pagarme/eventos.ts`): reconsulta a API e aplica. Lançar = retentar depois. */
export async function tratarEventoPagarme(evento: EventoPagarmeRow): Promise<'processado' | 'ignorado'> {
  const payload = evento.payload as unknown as PagarmeWebhookPayload;
  const ids = idsDoWebhook(payload.data ?? {});
  const { cobrancaId } = ids;
  let { pedidoId } = ids;
  try {
    if (!pedidoId && cobrancaId) pedidoId = (await consultarCobranca(cobrancaId)).order?.id ?? null;
    if (!pedidoId) return 'ignorado';
    const pedido = await consultarPedido(pedidoId);
    const r = await aplicarPedidoPagarme(pedido, {
      evento: evento.evento, eventoId: evento.id, ocorridoEm: evento.criado_gateway_em ?? evento.recebido_em, origem: 'webhook',
    });
    return r.resultado;
  } catch (err) {
    if (err instanceof PagarmeError && err.status === 404) return 'ignorado';
    throw err;
  }
}

/** Sincronização manual (admin): reconsulta o pedido da Pagar.me de um pagamento. */
export async function sincronizarPagamentoPagarme(gatewayPedidoId: string): Promise<ResultadoPagarme> {
  const pedido = await consultarPedido(gatewayPedidoId);
  return aplicarPedidoPagarme(pedido, { evento: null, eventoId: null, ocorridoEm: null, origem: 'sincronizacao' });
}
