/** Formato de uma linha da lista de pedidos (admin) — sem dependência de servidor. */

import type {
  AsaasAmbienteDb,
  FormaPagamentoCodigo,
  PagamentoStatus,
  PedidoStatus,
  ReservaStatus,
  ReservaTipo,
} from '@/types/supabase';

/** Pagamentos em que o dinheiro entrou (inclui os que depois tiveram estorno parcial/disputa). */
export const PAGAMENTO_COM_DINHEIRO: PagamentoStatus[] = ['confirmado', 'recebido', 'estornado_parcial', 'em_disputa'];

export type PagamentoLinha = {
  id: string;
  forma_pagamento: FormaPagamentoCodigo;
  status: PagamentoStatus;
  numero_parcelas: number;
  ambiente: AsaasAmbienteDb;
  valor_tarifa: number | null;
  valor_liquido: number | null;
  asaas_payment_id: string | null;
  criado_em: string;
  recebido_em: string | null;
  credito_previsto_em: string | null;
  pagamento_cartao: { bandeira: string; ultimos_digitos: string } | { bandeira: string; ultimos_digitos: string }[] | null;
};

export type PedidoLinha = {
  id: string;
  numero: number;
  status: PedidoStatus;
  criado_em: string;
  expira_em: string | null;
  pago_em: string | null;
  cancelado_em: string | null;
  valor_itens: number;
  comissao_percentual: number;
  valor_comissao: number;
  valor_desconto: number;
  valor_total: number;
  cliente: { id: string; name: string; email: string; cpf_cnpj: string | null } | null;
  gestor: { id: string; name: string; email: string } | null;
  reserva: {
    id: string;
    tipo: ReservaTipo;
    item_nome: string;
    data_reserva: string;
    data_fim_reserva: string | null;
    quantidade_pessoas: number;
    status: ReservaStatus;
  } | null;
  pagamento: PagamentoLinha[];
  pedido_desconto: { cupom_codigo: string | null }[];
};


/** Pagamento que "representa" o pedido na lista: o pago, senão a tentativa mais recente. */
export function pagamentoPrincipal(p: PedidoLinha): PagamentoLinha | null {
  if (!p.pagamento.length) return null;
  const pago = p.pagamento.find((pg) => PAGAMENTO_COM_DINHEIRO.includes(pg.status) || pg.status === 'estornado');
  if (pago) return pago;
  return [...p.pagamento].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
}

export function cartaoDe(pg: PagamentoLinha | null): string | null {
  if (!pg?.pagamento_cartao) return null;
  const c = Array.isArray(pg.pagamento_cartao) ? pg.pagamento_cartao[0] : pg.pagamento_cartao;
  return c ? `${c.bandeira} •••• ${c.ultimos_digitos}` : null;
}
