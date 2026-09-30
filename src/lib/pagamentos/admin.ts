import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { AsaasError, mensagemErroAsaas } from '@/lib/asaas/client';
import { consultarCobranca, listarCobrancasDoParcelamento, removerCobranca } from '@/lib/asaas/cobrancas';
import type { AsaasCobranca } from '@/lib/asaas/tipos';
import type { PagamentoStatus } from '@/types/supabase';
import { emailPagamentoConfirmado, emailPagamentoPendente } from './emails';
import { dadosParaEmail, PAGAMENTO_CANCELAVEL } from './pedidos';
import { aplicarCobranca } from './webhook';

/**
 * Operações manuais do admin sobre um pedido (Admin → Pedidos). Quem chama
 * (server action) valida a role e grava `financeiro_auditoria`.
 */

export type AlteracaoSincronizacao = {
  pagamentoId: string;
  cobranca: string;
  de: PagamentoStatus | null;
  para: PagamentoStatus | null;
};

/**
 * Consulta no Asaas todas as cobranças do pedido (parcelado: todas as
 * parcelas) e aplica o estado atual — mesma lógica do webhook, sem registrar
 * movimento no histórico. Cobrança que não existe mais no Asaas (404) e ainda
 * estava pendente é marcada como cancelada.
 */
export async function sincronizarPedidoComAsaas(
  pedidoId: string,
): Promise<{ consultadas: number; alteracoes: AlteracaoSincronizacao[]; erros: string[] }> {
  const { data: pagamentos } = await supabaseAdmin
    .from('pagamento')
    .select('id, status, asaas_payment_id, asaas_parcelamento_id')
    .eq('pedido_id', pedidoId)
    .not('asaas_payment_id', 'is', null)
    .order('criado_em');

  const resultado = { consultadas: 0, alteracoes: [] as AlteracaoSincronizacao[], erros: [] as string[] };

  for (const p of pagamentos ?? []) {
    let cobrancas: AsaasCobranca[];
    try {
      cobrancas = p.asaas_parcelamento_id
        ? await listarCobrancasDoParcelamento(p.asaas_parcelamento_id)
        : [await consultarCobranca(p.asaas_payment_id!)];
    } catch (err) {
      if (err instanceof AsaasError && err.status === 404) {
        const { data: cancelado } = await supabaseAdmin
          .from('pagamento')
          .update({ status: 'cancelado', status_asaas: 'DELETED' })
          .eq('id', p.id)
          .in('status', PAGAMENTO_CANCELAVEL)
          .select('id')
          .maybeSingle();
        if (cancelado) {
          resultado.alteracoes.push({ pagamentoId: p.id, cobranca: p.asaas_payment_id!, de: p.status as PagamentoStatus, para: 'cancelado' });
        }
        resultado.erros.push(`Cobrança ${p.asaas_payment_id} não existe mais no Asaas.`);
      } else {
        resultado.erros.push(`${p.asaas_payment_id}: ${mensagemErroAsaas(err)}`);
      }
      continue;
    }

    for (const c of cobrancas) {
      resultado.consultadas++;
      const r = await aplicarCobranca(c, { evento: null, eventoId: null, ocorridoEm: null });
      if (r.resultado === 'processado' && r.statusAnterior !== r.statusNovo) {
        resultado.alteracoes.push({ pagamentoId: p.id, cobranca: c.id, de: r.statusAnterior ?? null, para: r.statusNovo ?? null });
      }
    }
  }
  return resultado;
}

/**
 * Estende o prazo de pagamento de um pedido aguardando pagamento: novo prazo =
 * (o maior entre o prazo atual e agora) + `horas`, limitado ao fim do dia do
 * passeio. Cobranças pendentes continuam valendo; se o Asaas as marcar como
 * vencidas, a página do cliente gera outra automaticamente.
 */
export async function prorrogarPrazoPedido(
  pedidoId: string,
  horas: number,
): Promise<{ ok: true; antes: string | null; depois: string } | { ok: false; erro: string }> {
  if (!Number.isInteger(horas) || horas < 1 || horas > 168) return { ok: false, erro: 'Informe de 1 a 168 horas.' };

  const { data } = await supabaseAdmin
    .from('pedido')
    .select('status, expira_em, reserva:reserva_id ( data_reserva )')
    .eq('id', pedidoId)
    .maybeSingle();
  const pedido = data as unknown as { status: string; expira_em: string | null; reserva: { data_reserva: string } | null } | null;
  if (!pedido?.reserva) return { ok: false, erro: 'Pedido não encontrado.' };
  if (pedido.status !== 'aguardando_pagamento') return { ok: false, erro: 'Só pedidos aguardando pagamento têm prazo.' };

  const agora = Date.now();
  const base = Math.max(pedido.expira_em ? new Date(pedido.expira_em).getTime() : agora, agora);
  const limite = new Date(`${pedido.reserva.data_reserva}T23:59:59-03:00`).getTime();
  const novo = Math.min(base + horas * 3_600_000, limite);
  if (novo <= agora || (pedido.expira_em && novo <= new Date(pedido.expira_em).getTime())) {
    return { ok: false, erro: 'O prazo já está no limite (fim do dia do passeio).' };
  }

  const depois = new Date(novo).toISOString();
  const { error } = await supabaseAdmin
    .from('pedido')
    .update({ expira_em: depois })
    .eq('id', pedidoId)
    .eq('status', 'aguardando_pagamento');
  if (error) return { ok: false, erro: error.message };
  return { ok: true, antes: pedido.expira_em, depois };
}

/** Remove no Asaas uma cobrança ainda não paga e marca o pagamento como cancelado. */
export async function cancelarPagamentoPendente(
  pagamentoId: string,
): Promise<{ ok: true; pedidoId: string; cobranca: string | null } | { ok: false; erro: string }> {
  const { data: p } = await supabaseAdmin
    .from('pagamento')
    .select('id, pedido_id, status, asaas_payment_id, asaas_parcelamento_id')
    .eq('id', pagamentoId)
    .maybeSingle();
  if (!p) return { ok: false, erro: 'Pagamento não encontrado.' };
  if (!PAGAMENTO_CANCELAVEL.includes(p.status as PagamentoStatus)) {
    return { ok: false, erro: 'Só cobranças pendentes, em análise ou vencidas podem ser canceladas.' };
  }
  if (p.asaas_payment_id) {
    try {
      await removerCobranca({ paymentId: p.asaas_payment_id, parcelamentoId: p.asaas_parcelamento_id });
    } catch (err) {
      return { ok: false, erro: `O Asaas recusou a remoção: ${mensagemErroAsaas(err)}` };
    }
  }
  await supabaseAdmin.from('pagamento').update({ status: 'cancelado' }).eq('id', p.id).in('status', PAGAMENTO_CANCELAVEL);
  return { ok: true, pedidoId: p.pedido_id, cobranca: p.asaas_payment_id };
}

/**
 * Reenvia o e-mail do momento do pedido: "pague até…" (aguardando pagamento)
 * ou "pagamento confirmado" (pago).
 */
export async function reenviarEmailPedido(
  pedidoId: string,
): Promise<{ ok: true; tipo: 'cobranca' | 'confirmacao'; para: string } | { ok: false; erro: string }> {
  const { data: pedido } = await supabaseAdmin
    .from('pedido')
    .select('status, expira_em')
    .eq('id', pedidoId)
    .maybeSingle();
  if (!pedido) return { ok: false, erro: 'Pedido não encontrado.' };

  const d = await dadosParaEmail(pedidoId);
  if (!d?.reserva || !d.cliente?.email) return { ok: false, erro: 'Cliente sem e-mail.' };
  const base = {
    para: d.cliente.email,
    nome: d.cliente.name,
    reservaId: d.reserva_id,
    pedidoNumero: d.numero,
    itemNome: d.reserva.item_nome,
    dataReserva: d.reserva.data_reserva,
    valorTotal: Number(d.valor_total),
  };

  if (pedido.status === 'aguardando_pagamento' && pedido.expira_em) {
    await emailPagamentoPendente({ ...base, expiraEm: pedido.expira_em });
    return { ok: true, tipo: 'cobranca', para: d.cliente.email };
  }
  if (pedido.status === 'pago') {
    await emailPagamentoConfirmado(base);
    return { ok: true, tipo: 'confirmacao', para: d.cliente.email };
  }
  return { ok: false, erro: 'Não há e-mail a reenviar neste status do pedido.' };
}
