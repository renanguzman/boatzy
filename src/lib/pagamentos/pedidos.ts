import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { removerCobranca } from '@/lib/asaas/cobrancas';
import { mensagemErroAsaas } from '@/lib/asaas/client';
import type { PagamentoStatus } from '@/types/supabase';
import { emailPagamentoConfirmado, emailPedidoExpirado, emailReservaPaga } from './emails';

/**
 * Ciclo de vida do pedido (SPEC §34.11):
 *
 *   aceite do gestor → pedido `aguardando_pagamento` + reserva `aguardando_pagamento` (segura a data)
 *   pagamento confirmado (webhook) → pedido `pago` + reserva `confirmada`
 *   prazo vencido sem pagamento → cobranças removidas no Asaas → pedido `expirado` + reserva `expirada`
 *
 * Toda transição é guardada pelo status de origem (UPDATE … WHERE status = …),
 * então chamadas repetidas ou concorrentes não fazem nada a mais.
 */

/** Pagamentos em que nada foi pago — podem ser removidos no Asaas. */
export const PAGAMENTO_CANCELAVEL: PagamentoStatus[] = ['pendente', 'em_analise', 'vencido'];
/** Pagamentos com dinheiro confirmado. */
export const PAGAMENTO_PAGO: PagamentoStatus[] = ['confirmado', 'recebido'];

/**
 * Prazo para pagar: `horas` após o aceite, mas nunca depois do fim do dia do
 * passeio (a reserva só tem data — horário de Brasília, sem horário de verão).
 */
export function calcularExpiracao(agora: Date, horas: number, dataReserva: string): Date {
  const pelaJanela = new Date(agora.getTime() + horas * 3_600_000);
  const fimDoDiaDoPasseio = new Date(`${dataReserva}T23:59:59-03:00`);
  return pelaJanela < fimDoDiaDoPasseio ? pelaJanela : fimDoDiaDoPasseio;
}

/**
 * Remove no Asaas as cobranças ainda não pagas do pedido e marca os pagamentos
 * como `cancelado`. Devolve `ok: false` se alguma remoção falhou (ex.: a
 * cobrança acabou de ser paga) — quem chamou não deve encerrar o pedido.
 */
export async function cancelarCobrancasPendentes(
  pedidoId: string,
  opts: { excetoPagamentoId?: string } = {},
): Promise<{ ok: boolean; erro?: string }> {
  let consulta = supabaseAdmin
    .from('pagamento')
    .select('id, asaas_payment_id, asaas_parcelamento_id')
    .eq('pedido_id', pedidoId)
    .in('status', PAGAMENTO_CANCELAVEL);
  if (opts.excetoPagamentoId) consulta = consulta.neq('id', opts.excetoPagamentoId);
  const { data: pendentes, error } = await consulta;
  if (error) return { ok: false, erro: error.message };

  let erro: string | undefined;
  for (const p of pendentes ?? []) {
    if (p.asaas_payment_id) {
      try {
        await removerCobranca({ paymentId: p.asaas_payment_id, parcelamentoId: p.asaas_parcelamento_id });
      } catch (err) {
        erro = mensagemErroAsaas(err);
        console.error('[pagamentos/pedidos] falha ao remover cobrança', p.asaas_payment_id, erro);
        continue;
      }
    }
    // O movimento "cancelamento" entra no histórico pelo webhook PAYMENT_DELETED.
    await supabaseAdmin
      .from('pagamento')
      .update({ status: 'cancelado' })
      .eq('id', p.id)
      .in('status', PAGAMENTO_CANCELAVEL);
  }
  return erro ? { ok: false, erro } : { ok: true };
}

async function dadosParaEmail(pedidoId: string) {
  const { data } = await supabaseAdmin
    .from('pedido')
    .select(
      `numero, valor_total, valor_itens, reserva_id,
       reserva:reserva_id ( item_nome, data_reserva ),
       cliente:users!pedido_cliente_id_fkey ( name, email ),
       gestor:users!pedido_gestor_id_fkey ( name, email )`,
    )
    .eq('id', pedidoId)
    .single();
  return data as unknown as {
    numero: number;
    valor_total: number;
    valor_itens: number;
    reserva_id: string;
    reserva: { item_nome: string; data_reserva: string } | null;
    cliente: { name: string; email: string } | null;
    gestor: { name: string; email: string } | null;
  } | null;
}

/**
 * Pagamento confirmado: pedido → `pago`, reserva → `confirmada`, remove as
 * outras cobranças pendentes do mesmo pedido (ex.: um Pix gerado antes de o
 * cliente pagar no cartão) e avisa cliente e gestor. Idempotente.
 * Devolve false se o pedido não estava aguardando pagamento.
 */
export async function confirmarPedidoPago(pedidoId: string): Promise<boolean> {
  const { data: pedido } = await supabaseAdmin
    .from('pedido')
    .update({ status: 'pago', pago_em: new Date().toISOString() })
    .eq('id', pedidoId)
    .eq('status', 'aguardando_pagamento')
    .select('id, reserva_id')
    .maybeSingle();
  if (!pedido) return false;

  const { error } = await supabaseAdmin
    .from('reserva')
    .update({ status: 'confirmada' })
    .eq('id', pedido.reserva_id)
    .eq('status', 'aguardando_pagamento');
  if (error) console.error('[pagamentos/pedidos] falha ao confirmar reserva', pedido.reserva_id, error.message);

  await cancelarCobrancasPendentes(pedidoId);

  const d = await dadosParaEmail(pedidoId);
  if (d?.reserva) {
    const base = {
      reservaId: d.reserva_id,
      pedidoNumero: d.numero,
      itemNome: d.reserva.item_nome,
      dataReserva: d.reserva.data_reserva,
      valorTotal: Number(d.valor_total),
    };
    await Promise.all([
      emailPagamentoConfirmado({ ...base, para: d.cliente?.email ?? '', nome: d.cliente?.name ?? '' }),
      emailReservaPaga({
        ...base,
        para: d.gestor?.email ?? '',
        nome: d.gestor?.name ?? '',
        clienteNome: d.cliente?.name ?? 'O cliente',
        valorItens: Number(d.valor_itens),
      }),
    ]);
  }
  return true;
}

/**
 * Encerra pedidos cujo prazo de pagamento passou: remove as cobranças no Asaas
 * (para não poderem mais ser pagas), marca pedido `expirado` e reserva
 * `expirada` (libera a data) e avisa o cliente. Pedido com pagamento já
 * confirmado (webhook ainda não aplicado) é confirmado em vez de expirado.
 */
export async function expirarPedidosVencidos(limite = 25): Promise<number> {
  const { data: vencidos, error } = await supabaseAdmin
    .from('pedido')
    .select('id, reserva_id')
    .eq('status', 'aguardando_pagamento')
    .lt('expira_em', new Date().toISOString())
    .order('expira_em')
    .limit(limite);
  if (error) {
    console.error('[pagamentos/pedidos] falha ao listar pedidos vencidos', error.message);
    return 0;
  }

  let expirados = 0;
  for (const pedido of vencidos ?? []) {
    const { count: pagos } = await supabaseAdmin
      .from('pagamento')
      .select('id', { count: 'exact', head: true })
      .eq('pedido_id', pedido.id)
      .in('status', PAGAMENTO_PAGO);
    if (pagos) {
      await confirmarPedidoPago(pedido.id);
      continue;
    }

    const cancelamento = await cancelarCobrancasPendentes(pedido.id);
    if (!cancelamento.ok) continue; // tenta de novo na próxima rodada

    const agora = new Date().toISOString();
    const { data: expirado } = await supabaseAdmin
      .from('pedido')
      .update({ status: 'expirado', cancelado_em: agora, motivo_cancelamento: 'Prazo de pagamento expirado' })
      .eq('id', pedido.id)
      .eq('status', 'aguardando_pagamento')
      .select('id')
      .maybeSingle();
    if (!expirado) continue;

    await supabaseAdmin
      .from('reserva')
      .update({ status: 'expirada', expirada_em: agora })
      .eq('id', pedido.reserva_id)
      .eq('status', 'aguardando_pagamento');
    expirados++;

    const d = await dadosParaEmail(pedido.id);
    if (d?.reserva) {
      await emailPedidoExpirado({
        reservaId: d.reserva_id,
        pedidoNumero: d.numero,
        itemNome: d.reserva.item_nome,
        dataReserva: d.reserva.data_reserva,
        valorTotal: Number(d.valor_total),
        para: d.cliente?.email ?? '',
        nome: d.cliente?.name ?? '',
      });
    }
  }
  return expirados;
}

/** Versão para chamar ao carregar páginas (transição lazy): nunca lança. */
export async function expirarPedidosVencidosSemFalhar(): Promise<void> {
  try {
    await expirarPedidosVencidos();
  } catch (err) {
    console.error('[pagamentos/pedidos] expiração lazy falhou', err instanceof Error ? err.message : err);
  }
}

/**
 * Cancela o pedido de uma reserva que ainda aguarda pagamento (ex.: o cliente
 * cancelou a solicitação). Remove as cobranças no Asaas antes; se alguma já
 * foi paga, não cancela.
 */
export async function cancelarPedidoAguardando(reservaId: string, motivo: string): Promise<{ ok: boolean; erro?: string }> {
  const { data: pedido } = await supabaseAdmin
    .from('pedido')
    .select('id, status')
    .eq('reserva_id', reservaId)
    .maybeSingle();
  if (!pedido || pedido.status !== 'aguardando_pagamento') return { ok: true };

  const cancelamento = await cancelarCobrancasPendentes(pedido.id);
  if (!cancelamento.ok) return { ok: false, erro: 'Não foi possível cancelar a cobrança. Tente novamente em instantes.' };

  const { count: pagos } = await supabaseAdmin
    .from('pagamento')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedido.id)
    .in('status', PAGAMENTO_PAGO);
  if (pagos) return { ok: false, erro: 'Esta reserva já foi paga.' };

  await supabaseAdmin
    .from('pedido')
    .update({ status: 'cancelado', cancelado_em: new Date().toISOString(), motivo_cancelamento: motivo })
    .eq('id', pedido.id)
    .eq('status', 'aguardando_pagamento');
  return { ok: true };
}
