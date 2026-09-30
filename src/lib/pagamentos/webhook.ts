import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { AsaasCobranca } from '@/lib/asaas/tipos';
import type { EventoAsaasRow } from '@/lib/asaas/eventos';
import type { Database, Json, PagamentoParcelaStatus, PagamentoStatus, PedidoStatus } from '@/types/supabase';
import { confirmarPedidoPago } from './pedidos';

/**
 * Handler dos eventos `PAYMENT_*` do Asaas (registrado em
 * `src/lib/asaas/eventos.ts`). Idempotente: o histórico usa o id do evento
 * como chave única e as transições do pedido são guardadas pelo status.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tipo do movimento em `pagamento_transacao` a partir do evento. */
const TIPO_TRANSACAO: Record<string, string> = {
  PAYMENT_CREATED: 'criacao',
  PAYMENT_UPDATED: 'atualizacao',
  PAYMENT_AUTHORIZED: 'autorizacao',
  PAYMENT_AWAITING_RISK_ANALYSIS: 'analise_risco',
  PAYMENT_APPROVED_BY_RISK_ANALYSIS: 'aprovado_analise_risco',
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: 'recusa',
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: 'recusa',
  PAYMENT_CONFIRMED: 'confirmacao',
  PAYMENT_RECEIVED: 'recebimento',
  PAYMENT_ANTICIPATED: 'antecipacao',
  PAYMENT_OVERDUE: 'vencimento',
  PAYMENT_DELETED: 'cancelamento',
  PAYMENT_RESTORED: 'restauracao',
  PAYMENT_REFUND_IN_PROGRESS: 'estorno_em_andamento',
  PAYMENT_REFUNDED: 'estorno',
  PAYMENT_PARTIALLY_REFUNDED: 'estorno_parcial',
  PAYMENT_CHARGEBACK_REQUESTED: 'chargeback',
  PAYMENT_CHARGEBACK_DISPUTE: 'chargeback_disputa',
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: 'chargeback_revertido',
};

/**
 * Status normalizado do pagamento a partir do evento e do status cru da cobrança.
 * `evento` é null na sincronização manual (admin) — aí vale só a cobrança.
 */
function statusDoPagamento(evento: string | null, statusAsaas: string, removida = false): PagamentoStatus | null {
  if (evento === 'PAYMENT_DELETED' || (evento === null && removida)) return 'cancelado';
  if (evento === 'PAYMENT_REPROVED_BY_RISK_ANALYSIS' || evento === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') return 'recusado';
  if (evento === 'PAYMENT_PARTIALLY_REFUNDED') return 'estornado_parcial';
  switch (statusAsaas) {
    case 'PENDING':
    case 'AUTHORIZED':
      return 'pendente';
    case 'AWAITING_RISK_ANALYSIS':
      return 'em_analise';
    case 'CONFIRMED':
      return 'confirmado';
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
    case 'DUNNING_RECEIVED':
      return 'recebido';
    case 'OVERDUE':
      return 'vencido';
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      return 'estorno_em_andamento';
    case 'REFUNDED':
      return 'estornado';
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'AWAITING_CHARGEBACK_REVERSAL':
      return 'em_disputa';
    default:
      return null;
  }
}

/**
 * Ordem do caminho feliz: um evento atrasado (ex.: CONFIRMED chegando depois
 * do RECEIVED) não faz o status voltar. Status fora dessa lista (estorno,
 * disputa, cancelado, recusado) sempre se aplicam.
 */
const ORDEM_FELIZ: Partial<Record<PagamentoStatus, number>> = {
  pendente: 0, em_analise: 1, vencido: 1, confirmado: 2, recebido: 3,
};

function podeTransitar(atual: PagamentoStatus, novo: PagamentoStatus): boolean {
  const a = ORDEM_FELIZ[atual];
  const n = ORDEM_FELIZ[novo];
  if (a === undefined || n === undefined) return true;
  return n >= a;
}

/** Efeito do evento no pedido (além de confirmar o pagamento). */
const STATUS_PEDIDO: Partial<Record<PagamentoStatus, PedidoStatus>> = {
  estornado: 'reembolsado',
  estornado_parcial: 'reembolsado_parcial',
  em_disputa: 'em_disputa',
};

function dataParaIso(data: string | null | undefined): string | null {
  if (!data) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? `${data}T12:00:00-03:00` : data;
}

function statusParcela(status: PagamentoStatus): PagamentoParcelaStatus {
  if (status === 'confirmado' || status === 'recebido' || status === 'cancelado' || status === 'em_disputa') return status;
  if (status === 'estornado' || status === 'estornado_parcial') return 'estornado';
  return 'pendente';
}

async function localizarPagamento(c: AsaasCobranca) {
  const campos = 'id, pedido_id, status, numero_parcelas, valor, asaas_payment_id';
  const porId = await supabaseAdmin.from('pagamento').select(campos).eq('asaas_payment_id', c.id).maybeSingle();
  if (porId.data) return porId.data;
  if (c.externalReference && UUID.test(c.externalReference)) {
    const porRef = await supabaseAdmin.from('pagamento').select(campos).eq('id', c.externalReference).maybeSingle();
    if (porRef.data) return porRef.data;
  }
  if (c.installment) {
    const porParcelamento = await supabaseAdmin.from('pagamento').select(campos).eq('asaas_parcelamento_id', c.installment).maybeSingle();
    if (porParcelamento.data) return porParcelamento.data;
  }
  return null;
}

export async function tratarEventoCobranca(evento: EventoAsaasRow): Promise<'processado' | 'ignorado'> {
  const payload = evento.payload as Record<string, unknown>;
  const cobranca = payload.payment as AsaasCobranca | undefined;
  if (!cobranca?.id) return 'ignorado';
  const r = await aplicarCobranca(cobranca, {
    evento: evento.evento,
    eventoId: evento.id,
    ocorridoEm: evento.criado_asaas_em ?? evento.recebido_em,
  });
  return r.resultado;
}

export type ResultadoAplicacao = {
  resultado: 'processado' | 'ignorado';
  pagamentoId?: string;
  statusAnterior?: PagamentoStatus;
  statusNovo?: PagamentoStatus;
};

/**
 * Aplica o estado de uma cobrança do Asaas ao pagamento correspondente
 * (status, valores, datas, cartão, parcelas) e os efeitos no pedido/reserva.
 * Usado pelo webhook (com evento → registra o movimento no histórico) e pela
 * sincronização manual do admin (sem evento → não registra movimento; a
 * alteração fica na auditoria).
 */
export async function aplicarCobranca(
  cobranca: AsaasCobranca,
  contexto: { evento: string | null; eventoId: string | null; ocorridoEm: string | null },
): Promise<ResultadoAplicacao> {
  const pagamento = await localizarPagamento(cobranca);
  if (!pagamento) return { resultado: 'ignorado' }; // cobrança criada fora do checkout do Boatzy

  const parcelado = pagamento.numero_parcelas > 1 && !!cobranca.installment;
  const ehParcelaPrincipal = !parcelado || cobranca.id === pagamento.asaas_payment_id || (cobranca.installmentNumber ?? 1) === 1;
  const novoStatus = statusDoPagamento(contexto.evento, cobranca.status, cobranca.deleted === true);
  const statusAnterior = pagamento.status as PagamentoStatus;
  let statusAplicado: PagamentoStatus = statusAnterior;

  // Parcelas (cartão parcelado): cada parcela é uma cobrança no Asaas.
  let parcelaId: string | null = null;
  if (parcelado) {
    const { data: parcela } = await supabaseAdmin
      .from('pagamento_parcela')
      .upsert(
        {
          pagamento_id: pagamento.id,
          numero: cobranca.installmentNumber ?? 1,
          total: pagamento.numero_parcelas,
          valor: Number(cobranca.value),
          valor_liquido: cobranca.netValue != null ? Number(cobranca.netValue) : null,
          asaas_payment_id: cobranca.id,
          status_asaas: cobranca.status,
          ...(novoStatus ? { status: statusParcela(novoStatus) } : {}),
          vencimento: cobranca.dueDate ?? null,
          credito_previsto_em: cobranca.estimatedCreditDate ?? cobranca.creditDate ?? null,
          ...(novoStatus === 'recebido'
            ? { recebido_em: dataParaIso(cobranca.paymentDate ?? cobranca.clientPaymentDate) ?? new Date().toISOString() }
            : {}),
        },
        { onConflict: 'pagamento_id,numero' },
      )
      .select('id')
      .single();
    parcelaId = parcela?.id ?? null;
  }

  // Pagamento: o status segue a 1ª parcela (no cartão parcelado todas são cobradas juntas).
  if (ehParcelaPrincipal) {
    const atualizacao: Database['public']['Tables']['pagamento']['Update'] = {
      status_asaas: cobranca.status,
      fatura_url: cobranca.invoiceUrl ?? undefined,
      numero_fatura: cobranca.invoiceNumber ?? undefined,
      comprovante_url: cobranca.transactionReceiptUrl ?? undefined,
      pix_transacao_id: cobranca.pixTransaction ?? undefined,
      confirmado_em: dataParaIso(cobranca.confirmedDate) ?? undefined,
      credito_previsto_em: cobranca.estimatedCreditDate ?? cobranca.creditDate ?? undefined,
      ultimo_payload: cobranca as unknown as Json,
    };
    if (!parcelado && cobranca.netValue != null) atualizacao.valor_liquido = Number(cobranca.netValue);
    if (novoStatus === 'recebido') {
      atualizacao.recebido_em = dataParaIso(cobranca.paymentDate ?? cobranca.clientPaymentDate) ?? new Date().toISOString();
    }
    if (novoStatus && podeTransitar(statusAnterior, novoStatus)) {
      atualizacao.status = novoStatus;
      statusAplicado = novoStatus;
    }
    // Campos `undefined` não vão no JSON — não sobrescrevem o que já existe.
    await supabaseAdmin.from('pagamento').update(atualizacao).eq('id', pagamento.id);
  }

  // Parcelado: líquido = soma das parcelas conhecidas.
  if (parcelado) {
    const { data: parcelas } = await supabaseAdmin
      .from('pagamento_parcela')
      .select('valor_liquido')
      .eq('pagamento_id', pagamento.id);
    const liquidos = (parcelas ?? []).map((p) => p.valor_liquido).filter((v): v is number => v != null);
    if (liquidos.length === pagamento.numero_parcelas) {
      await supabaseAdmin
        .from('pagamento')
        .update({ valor_liquido: Math.round(liquidos.reduce((s, v) => s + Number(v), 0) * 100) / 100 })
        .eq('id', pagamento.id);
    }
  }

  // Cartão: só bandeira + 4 últimos dígitos (o Asaas nunca devolve o número completo).
  const final = cobranca.creditCard?.creditCardNumber ?? null;
  const bandeira = cobranca.creditCard?.creditCardBrand?.toUpperCase() ?? null;
  if (final && /^\d{4}$/.test(final) && bandeira && /^[A-Z_]{2,30}$/.test(bandeira)) {
    await supabaseAdmin
      .from('pagamento_cartao')
      .upsert({ pagamento_id: pagamento.id, bandeira, ultimos_digitos: final }, { onConflict: 'pagamento_id', ignoreDuplicates: true });
  }

  // Histórico de movimentos (1 linha por evento; a sincronização manual não gera movimento).
  if (contexto.evento && contexto.eventoId) {
    await supabaseAdmin.from('pagamento_transacao').upsert(
      {
        pagamento_id: pagamento.id,
        parcela_id: parcelaId,
        tipo: TIPO_TRANSACAO[contexto.evento] ?? contexto.evento.replace(/^PAYMENT_/, '').toLowerCase(),
        status_asaas: cobranca.status,
        valor: Number(cobranca.value),
        ocorrido_em: contexto.ocorridoEm ?? new Date().toISOString(),
        asaas_evento_id: contexto.eventoId,
        payload: cobranca as unknown as Json,
      },
      { onConflict: 'asaas_evento_id', ignoreDuplicates: true },
    );
  }

  // Pedido/reserva.
  if (ehParcelaPrincipal && (novoStatus === 'confirmado' || novoStatus === 'recebido')) {
    const confirmou = await confirmarPedidoPago(pagamento.pedido_id);
    if (!confirmou) {
      const { data: pedido } = await supabaseAdmin.from('pedido').select('status').eq('id', pagamento.pedido_id).single();
      if (pedido && pedido.status !== 'pago') {
        // Pagamento chegou para um pedido já encerrado (expirado/cancelado) — precisa de ação do admin (estorno).
        console.warn('[pagamentos/webhook] pagamento recebido para pedido encerrado', pagamento.pedido_id, pedido.status);
      }
    }
  } else if (ehParcelaPrincipal && novoStatus && STATUS_PEDIDO[novoStatus]) {
    await supabaseAdmin
      .from('pedido')
      .update({ status: STATUS_PEDIDO[novoStatus]! })
      .eq('id', pagamento.pedido_id)
      .in('status', ['pago', 'reembolsado_parcial', 'em_disputa']);
  }

  return { resultado: 'processado', pagamentoId: pagamento.id, statusAnterior, statusNovo: statusAplicado };
}
