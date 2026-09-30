'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { registrarAuditoria } from '@/lib/financeiro/auditoria';
import { expirarPedido } from '@/lib/pagamentos/pedidos';
import {
  cancelarPagamentoPendente,
  prorrogarPrazoPedido,
  reenviarEmailPedido,
  sincronizarPedidoComAsaas,
} from '@/lib/pagamentos/admin';
import { buscarPedidos, cartaoDe, lerFiltros, pagamentoPrincipal } from './_lib/consulta';
import { FORMA_LABEL, PAGAMENTO_STATUS, PEDIDO_STATUS, formatarDocumento } from './_lib/rotulos';

type Resultado = { ok: true; mensagem?: string } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };
  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };
  return { ok: true, userId: user.id };
}

function exigirMotivo(motivo: string): string | null {
  const m = motivo.trim();
  return m.length >= 5 ? m : null;
}

function revalidar(pedidoId: string) {
  revalidatePath('/administrator/pedidos');
  revalidatePath(`/administrator/pedidos/${pedidoId}`);
}

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
const dataCurta = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';

/** Linhas planas para a planilha — mesmos filtros da tela (querystring). */
export async function exportarPedidos(
  querystring: string,
): Promise<{ ok: true; linhas: Record<string, string | number>[] } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const sp = Object.fromEntries(new URLSearchParams(querystring));
  const { linhas } = await buscarPedidos(lerFiltros(sp));
  return {
    ok: true,
    linhas: linhas.map((p) => {
      const pg = pagamentoPrincipal(p);
      const cupom = p.pedido_desconto.find((d) => d.cupom_codigo)?.cupom_codigo ?? '';
      return {
        Pedido: p.numero,
        'Criado em': dataHora(p.criado_em),
        'Status do pedido': PEDIDO_STATUS[p.status].label,
        Cliente: p.cliente?.name ?? '',
        'E-mail do cliente': p.cliente?.email ?? '',
        'CPF do cliente': formatarDocumento(p.cliente?.cpf_cnpj),
        Gestor: p.gestor?.name ?? '',
        'E-mail do gestor': p.gestor?.email ?? '',
        Item: p.reserva?.item_nome ?? '',
        Tipo: p.reserva?.tipo === 'embarcacao' ? 'Embarcação' : 'Roteiro',
        'Data do passeio': dataCurta(p.reserva?.data_reserva ?? null),
        Pessoas: p.reserva?.quantidade_pessoas ?? '',
        'Valor dos itens (gestor)': Number(p.valor_itens),
        'Comissão %': Number(p.comissao_percentual),
        'Comissão R$': Number(p.valor_comissao),
        Desconto: Number(p.valor_desconto),
        Cupom: cupom,
        'Total (cliente)': Number(p.valor_total),
        'Forma de pagamento': pg ? FORMA_LABEL[pg.forma_pagamento] : '',
        Parcelas: pg?.numero_parcelas ?? '',
        Cartão: cartaoDe(pg) ?? '',
        'Status do pagamento': pg ? PAGAMENTO_STATUS[pg.status].label : '',
        'Tentativas de pagamento': p.pagamento.length,
        'ID da cobrança (Asaas)': pg?.asaas_payment_id ?? '',
        Ambiente: pg?.ambiente === 'sandbox' ? 'Sandbox' : pg ? 'Produção' : '',
        'Tarifa Asaas': pg?.valor_tarifa != null ? Number(pg.valor_tarifa) : '',
        'Líquido recebido': pg?.valor_liquido != null ? Number(pg.valor_liquido) : '',
        'Prazo para pagar': dataHora(p.expira_em),
        'Pago em': dataHora(p.pago_em),
        'Crédito previsto': dataCurta(pg?.credito_previsto_em ?? null),
      };
    }),
  };
}

export async function sincronizarPedido(pedidoId: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const r = await sincronizarPedidoComAsaas(pedidoId);
  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'pedido.sincronizar',
    entidade: 'pedido',
    entidadeId: pedidoId,
    depois: r,
  });
  revalidar(pedidoId);

  const partes = [
    `${r.consultadas} cobrança(s) consultada(s)`,
    r.alteracoes.length ? `${r.alteracoes.length} alteração(ões) aplicada(s)` : 'nenhuma alteração',
  ];
  if (r.erros.length) return { ok: false, error: `${partes.join(', ')}. Avisos: ${r.erros.join(' ')}` };
  return { ok: true, mensagem: `${partes.join(', ')}.` };
}

export async function prorrogarPrazo(pedidoId: string, horas: number, motivo: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const m = exigirMotivo(motivo);
  if (!m) return { ok: false, error: 'Informe o motivo (mínimo 5 caracteres).' };

  const r = await prorrogarPrazoPedido(pedidoId, horas);
  if (!r.ok) return { ok: false, error: r.erro };
  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'pedido.prorrogar',
    entidade: 'pedido',
    entidadeId: pedidoId,
    antes: { expira_em: r.antes },
    depois: { expira_em: r.depois, horas },
    motivo: m,
  });
  revalidar(pedidoId);
  return { ok: true, mensagem: `Novo prazo: ${dataHora(r.depois)}.` };
}

export async function expirarPedidoAgora(pedidoId: string, motivo: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const m = exigirMotivo(motivo);
  if (!m) return { ok: false, error: 'Informe o motivo (mínimo 5 caracteres).' };

  const r = await expirarPedido(pedidoId, `Encerrado pelo admin: ${m}`);
  if (r === 'nao_aguardando') return { ok: false, error: 'O pedido não está aguardando pagamento.' };
  if (r === 'cobranca_nao_removida') {
    return { ok: false, error: 'Não foi possível remover a cobrança no Asaas (pode ter acabado de ser paga). Sincronize e tente de novo.' };
  }
  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'pedido.expirar',
    entidade: 'pedido',
    entidadeId: pedidoId,
    depois: { resultado: r },
    motivo: m,
  });
  revalidar(pedidoId);
  return {
    ok: true,
    mensagem: r === 'confirmado' ? 'Havia pagamento confirmado — o pedido foi confirmado em vez de expirado.' : 'Pedido expirado e data liberada.',
  };
}

export async function cancelarCobranca(pagamentoId: string, motivo: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const m = exigirMotivo(motivo);
  if (!m) return { ok: false, error: 'Informe o motivo (mínimo 5 caracteres).' };

  const r = await cancelarPagamentoPendente(pagamentoId);
  if (!r.ok) return { ok: false, error: r.erro };
  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'pagamento.cancelar',
    entidade: 'pedido',
    entidadeId: r.pedidoId,
    depois: { pagamento_id: pagamentoId, cobranca: r.cobranca },
    motivo: m,
  });
  revalidar(r.pedidoId);
  return { ok: true, mensagem: 'Cobrança removida no Asaas.' };
}

export async function reenviarEmail(pedidoId: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const r = await reenviarEmailPedido(pedidoId);
  if (!r.ok) return { ok: false, error: r.erro };
  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'pedido.reenviar_email',
    entidade: 'pedido',
    entidadeId: pedidoId,
    depois: r,
  });
  revalidar(pedidoId);
  return { ok: true, mensagem: `E-mail de ${r.tipo === 'cobranca' ? 'cobrança' : 'confirmação'} reenviado para ${r.para}.` };
}

export async function anotarPedido(pedidoId: string, texto: string): Promise<Resultado> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const t = texto.trim();
  if (t.length < 3) return { ok: false, error: 'Escreva a anotação.' };
  if (t.length > 2000) return { ok: false, error: 'Máximo de 2000 caracteres.' };

  const { data: pedido } = await supabaseAdmin.from('pedido').select('id').eq('id', pedidoId).maybeSingle();
  if (!pedido) return { ok: false, error: 'Pedido não encontrado.' };
  await registrarAuditoria({ adminId: auth.userId, acao: 'pedido.anotacao', entidade: 'pedido', entidadeId: pedidoId, motivo: t });
  revalidar(pedidoId);
  return { ok: true, mensagem: 'Anotação registrada.' };
}
