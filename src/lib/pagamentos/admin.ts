import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { AsaasError, mensagemErroAsaas } from '@/lib/asaas/client';
import { consultarCobranca, listarCobrancasDoParcelamento, removerCobranca } from '@/lib/asaas/cobrancas';
import type { AsaasCobranca } from '@/lib/asaas/tipos';
import type { Json, PagamentoStatus, PedidoTipo } from '@/types/supabase';
import { getFinanceiroConfig } from '@/lib/financeiro/config';
import { emailPagamentoConfirmado, emailPagamentoPendente } from './emails';
import { baseEmailPedido, dadosParaEmail, PAGAMENTO_CANCELAVEL } from './pedidos';
import { aplicarCobranca } from './webhook';
import { sincronizarPagamentoPagarme } from './pagarme';
import { estornarCobranca } from '@/lib/pagarme/pedidos';
import { mensagemErroPagarme, PagarmeError, paraCentavos } from '@/lib/pagarme/client';
import { lerPagarmeConfig } from '@/lib/pagarme/config';

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
 * Consulta nos gateways todas as tentativas do pedido e aplica o estado atual —
 * mesma lógica do webhook, sem registrar movimento no histórico (SPEC §109):
 * cartão na Stone/Pagar.me (reconsulta o pedido `or_…`) e cobranças do Asaas
 * (Pix e cartões antigos; parcelado: todas as parcelas). Cobrança que não existe
 * mais no Asaas (404) e ainda estava pendente é marcada como cancelada.
 */
export async function sincronizarPedidoComGateways(
  pedidoId: string,
): Promise<{ consultadas: number; alteracoes: AlteracaoSincronizacao[]; erros: string[] }> {
  const { data: pagamentos } = await supabaseAdmin
    .from('pagamento')
    .select('id, status, asaas_payment_id, asaas_parcelamento_id')
    .eq('pedido_id', pedidoId)
    .not('asaas_payment_id', 'is', null)
    .order('criado_em');

  const resultado = { consultadas: 0, alteracoes: [] as AlteracaoSincronizacao[], erros: [] as string[] };

  // Cartão na Pagar.me (SPEC §109): reconsulta o pedido de cada tentativa.
  const { data: tentativasPagarme } = await supabaseAdmin
    .from('pagamento')
    .select('id, gateway_pedido_id')
    .eq('pedido_id', pedidoId)
    .eq('gateway', 'pagarme')
    .not('gateway_pedido_id', 'is', null)
    .order('criado_em');
  if (tentativasPagarme?.length && !lerPagarmeConfig().ok) resultado.erros.push('Pagar.me não configurada neste ambiente.');
  else {
    for (const p of tentativasPagarme ?? []) {
      try {
        const r = await sincronizarPagamentoPagarme(p.gateway_pedido_id!);
        resultado.consultadas++;
        if (r.resultado === 'processado' && r.statusAnterior !== r.statusNovo) {
          resultado.alteracoes.push({ pagamentoId: p.id, cobranca: p.gateway_pedido_id!, de: r.statusAnterior ?? null, para: r.statusNovo ?? null });
        }
      } catch (err) {
        resultado.erros.push(`${p.gateway_pedido_id}: ${mensagemErroPagarme(err)}`);
      }
    }
  }

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
 * passeio (cobrança avulsa: ao prazo máximo de `financeiro_config`). Cobranças pendentes continuam valendo; se o Asaas as marcar como
 * vencidas, a página do cliente gera outra automaticamente.
 */
export async function prorrogarPrazoPedido(
  pedidoId: string,
  horas: number,
): Promise<{ ok: true; antes: string | null; depois: string } | { ok: false; erro: string }> {
  if (!Number.isInteger(horas) || horas < 1 || horas > 168) return { ok: false, erro: 'Informe de 1 a 168 horas.' };

  const { data } = await supabaseAdmin
    .from('pedido')
    .select('status, tipo, expira_em, reserva:reserva_id ( data_reserva )')
    .eq('id', pedidoId)
    .maybeSingle();
  const pedido = data as unknown as {
    status: string; tipo: PedidoTipo; expira_em: string | null; reserva: { data_reserva: string } | null;
  } | null;
  if (!pedido || (pedido.tipo === 'reserva' && !pedido.reserva)) return { ok: false, erro: 'Pedido não encontrado.' };
  if (pedido.status !== 'aguardando_pagamento') return { ok: false, erro: 'Só pedidos aguardando pagamento têm prazo.' };

  const agora = Date.now();
  const base = Math.max(pedido.expira_em ? new Date(pedido.expira_em).getTime() : agora, agora);
  // Pedido da reserva: até o fim do dia do passeio. Cobrança avulsa: até o prazo máximo configurado, contado de agora.
  const limite = pedido.tipo === 'avulso'
    ? agora + (await getFinanceiroConfig()).avulso_prazo_max_dias * 86_400_000
    : new Date(`${pedido.reserva!.data_reserva}T23:59:59-03:00`).getTime();
  const novo = Math.min(base + horas * 3_600_000, limite);
  if (novo <= agora || (pedido.expira_em && novo <= new Date(pedido.expira_em).getTime())) {
    return {
      ok: false,
      erro: pedido.tipo === 'avulso' ? 'O prazo já está no limite máximo da cobrança avulsa.' : 'O prazo já está no limite (fim do dia do passeio).',
    };
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
    .select('id, pedido_id, status, asaas_payment_id, asaas_parcelamento_id, gateway, gateway_cobranca_id')
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
  if (p.gateway === 'pagarme' && p.gateway_cobranca_id) {
    try {
      await estornarCobranca(p.gateway_cobranca_id);
    } catch (err) {
      if (!(err instanceof PagarmeError && err.status === 404)) {
        return { ok: false, erro: `A Pagar.me recusou o cancelamento: ${mensagemErroPagarme(err)}` };
      }
    }
  }
  await supabaseAdmin.from('pagamento').update({ status: 'cancelado' }).eq('id', p.id).in('status', PAGAMENTO_CANCELAVEL);
  return { ok: true, pedidoId: p.pedido_id, cobranca: p.asaas_payment_id ?? p.gateway_cobranca_id };
}

const ESTORNAVEL: PagamentoStatus[] = ['confirmado', 'recebido', 'estornado_parcial'];

/**
 * Estorno de cartão pela Pagar.me (D-S8, SPEC §109): total (sem valor) ou
 * parcial. Devolve ao cliente o valor cobrado (com juros, no total). Registra o
 * estorno, reconsulta o pedido na Pagar.me e aplica (pedido → reembolsado /
 * reembolsado_parcial, e-mails ao cliente e ao gestor). O estorno contábil do
 * ledger e o ajuste do repasse entram na Fase 2 (cancelamentos).
 */
export async function estornarPagamentoCartao(input: {
  pagamentoId: string;
  valor: number | null;
  motivo: string;
  adminId: string;
}): Promise<{ ok: true; pedidoId: string; valor: number; status: PagamentoStatus | null } | { ok: false; erro: string }> {
  const { data: p } = await supabaseAdmin
    .from('pagamento')
    .select('id, pedido_id, status, valor, gateway, gateway_cobranca_id, gateway_pedido_id, pagamento_estorno ( valor, status )')
    .eq('id', input.pagamentoId)
    .maybeSingle();
  if (!p) return { ok: false, erro: 'Pagamento não encontrado.' };
  if (p.gateway !== 'pagarme' || !p.gateway_cobranca_id || !p.gateway_pedido_id) {
    return { ok: false, erro: 'O estorno pelo admin vale para cartão na Pagar.me. Pagamentos do Asaas: estorne no painel do Asaas.' };
  }
  if (!ESTORNAVEL.includes(p.status as PagamentoStatus)) return { ok: false, erro: 'Só pagamentos confirmados podem ser estornados.' };

  const jaEstornado = ((p.pagamento_estorno ?? []) as { valor: number; status: string }[])
    .filter((e) => e.status !== 'cancelado')
    .reduce((s, e) => s + Number(e.valor), 0);
  const disponivel = Math.round((Number(p.valor) - jaEstornado) * 100) / 100;
  const valor = input.valor == null ? disponivel : Math.round(input.valor * 100) / 100;
  if (!(valor > 0) || valor > disponivel) {
    return { ok: false, erro: `Valor inválido: o máximo estornável é R$ ${disponivel.toFixed(2).replace('.', ',')}.` };
  }

  let resposta;
  try {
    resposta = await estornarCobranca(p.gateway_cobranca_id, valor < disponivel || jaEstornado > 0 ? paraCentavos(valor) : undefined);
  } catch (err) {
    return { ok: false, erro: `A Pagar.me recusou o estorno: ${mensagemErroPagarme(err)}` };
  }

  await supabaseAdmin.from('pagamento_estorno').insert({
    pagamento_id: p.id,
    valor,
    motivo: input.motivo,
    origem: 'admin',
    status: 'concluido',
    solicitado_por: input.adminId,
    concluido_em: new Date().toISOString(),
    payload: resposta as unknown as Json,
  });
  const r = await sincronizarPagamentoPagarme(p.gateway_pedido_id).catch((err) => {
    console.error('[pagamentos/admin] estorno feito, mas a sincronização falhou', p.id, mensagemErroPagarme(err));
    return null;
  });
  return { ok: true, pedidoId: p.pedido_id, valor, status: r?.statusNovo ?? null };
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
  const dadosBase = d ? baseEmailPedido(d) : null;
  if (!d || !dadosBase || !d.cliente?.email) return { ok: false, erro: 'Cliente sem e-mail.' };
  const base = { ...dadosBase, para: d.cliente.email, nome: d.cliente.name };

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
