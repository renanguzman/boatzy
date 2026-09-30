import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { FormaPagamentoCodigo, PedidoStatus } from '@/types/supabase';
import { PAGAMENTO_COM_DINHEIRO, type PedidoLinha } from './linha';

export { cartaoDe, pagamentoPrincipal, type PagamentoLinha, type PedidoLinha } from './linha';

/**
 * Consulta da lista de pedidos do admin. Traz todos os pedidos que batem com
 * os filtros (até LIMITE) e calcula indicadores, ordenação e paginação em
 * memória — suficiente para o volume atual e permite ordenar por cliente/
 * gestor e exportar exatamente o que está filtrado.
 */

export const LIMITE = 5000;

const STATUS_PEDIDO: PedidoStatus[] = [
  'aguardando_pagamento', 'pago', 'expirado', 'cancelado', 'reembolsado', 'reembolsado_parcial', 'em_disputa',
];
const FORMAS: FormaPagamentoCodigo[] = ['pix', 'cartao_credito'];
export const ORDENACOES = ['numero', 'criado_em', 'cliente', 'gestor', 'data_passeio', 'valor_total', 'status'] as const;
export type Ordenacao = (typeof ORDENACOES)[number];

export type FiltrosPedidos = {
  q: string;
  status: PedidoStatus | null;
  forma: FormaPagamentoCodigo | null;
  de: string | null; // AAAA-MM-DD (criação do pedido)
  ate: string | null;
  sort: Ordenacao;
  asc: boolean;
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerFiltros(sp: Record<string, string | undefined>): FiltrosPedidos {
  return {
    // Remove caracteres que quebram a sintaxe do or() do PostgREST.
    q: (sp.q ?? '').trim().replace(/[,()"%*]/g, ''),
    status: STATUS_PEDIDO.includes(sp.status as PedidoStatus) ? (sp.status as PedidoStatus) : null,
    forma: FORMAS.includes(sp.forma as FormaPagamentoCodigo) ? (sp.forma as FormaPagamentoCodigo) : null,
    de: sp.de && DATA.test(sp.de) ? sp.de : null,
    ate: sp.ate && DATA.test(sp.ate) ? sp.ate : null,
    sort: ORDENACOES.includes(sp.sort as Ordenacao) ? (sp.sort as Ordenacao) : 'criado_em',
    asc: sp.dir === 'asc',
  };
}

const SELECT = `id, numero, status, criado_em, expira_em, pago_em, cancelado_em,
  valor_itens, comissao_percentual, valor_comissao, valor_desconto, valor_total,
  cliente:users!pedido_cliente_id_fkey ( id, name, email, cpf_cnpj ),
  gestor:users!pedido_gestor_id_fkey ( id, name, email ),
  reserva:reserva_id ( id, tipo, item_nome, data_reserva, data_fim_reserva, quantidade_pessoas, status ),
  pagamento ( id, forma_pagamento, status, numero_parcelas, ambiente, valor_tarifa, valor_liquido,
              asaas_payment_id, criado_em, recebido_em, credito_previsto_em,
              pagamento_cartao ( bandeira, ultimos_digitos ) ),
  pedido_desconto ( cupom_codigo )`;

/**
 * Traduz a busca livre em cláusulas do or(): nº do pedido, ids (pedido,
 * reserva, cliente, gestor), nome/e-mail de cliente ou gestor, item, ids do
 * Asaas (pay_/cus_/parcelamento) e código de cupom. `[]` = nada encontrado.
 */
async function clausulasDaBusca(q: string): Promise<string[]> {
  const clausulas: string[] = [];
  const numero = q.replace(/^#/, '');
  if (/^\d{1,12}$/.test(numero)) clausulas.push(`numero.eq.${numero}`);
  if (UUID.test(q)) clausulas.push(`id.eq.${q}`, `reserva_id.eq.${q}`, `cliente_id.eq.${q}`, `gestor_id.eq.${q}`);
  if (q.length < 2) return clausulas;

  const [usuarios, reservas, pagamentos, descontos] = await Promise.all([
    supabaseAdmin.from('users').select('id').or(`name.ilike.%${q}%,email.ilike.%${q}%`).limit(200),
    supabaseAdmin.from('reserva').select('id').ilike('item_nome', `%${q}%`).limit(300),
    supabaseAdmin
      .from('pagamento')
      .select('pedido_id')
      .or(`asaas_payment_id.ilike.%${q}%,asaas_customer_id.ilike.%${q}%,asaas_parcelamento_id.ilike.%${q}%`)
      .limit(200),
    supabaseAdmin.from('pedido_desconto').select('pedido_id').ilike('cupom_codigo', `%${q}%`).limit(200),
  ]);

  const idsUsuarios = (usuarios.data ?? []).map((u) => u.id);
  if (idsUsuarios.length) {
    clausulas.push(`cliente_id.in.(${idsUsuarios.join(',')})`, `gestor_id.in.(${idsUsuarios.join(',')})`);
  }
  const idsReservas = (reservas.data ?? []).map((r) => r.id);
  if (idsReservas.length) clausulas.push(`reserva_id.in.(${idsReservas.join(',')})`);
  const idsPedidos = [...new Set([...(pagamentos.data ?? []), ...(descontos.data ?? [])].map((p) => p.pedido_id))];
  if (idsPedidos.length) clausulas.push(`id.in.(${idsPedidos.join(',')})`);
  return clausulas;
}

export type IndicadoresPedidos = {
  total: number;
  aguardando: { qtd: number; valor: number };
  pagos: { qtd: number; valor: number };
  encerrados: number; // expirados + cancelados
  comissaoLiquida: number; // comissão − desconto dos pagos
  tarifas: number; // tarifa do Asaas dos pagamentos pagos
  margem: number; // comissão líquida − tarifas
  aRepassar: number; // valor dos itens dos pagos (gestores)
};

const PAGO: PedidoStatus[] = ['pago', 'reembolsado_parcial', 'em_disputa'];

function calcularIndicadores(linhas: PedidoLinha[]): IndicadoresPedidos {
  const r: IndicadoresPedidos = {
    total: linhas.length,
    aguardando: { qtd: 0, valor: 0 },
    pagos: { qtd: 0, valor: 0 },
    encerrados: 0,
    comissaoLiquida: 0,
    tarifas: 0,
    margem: 0,
    aRepassar: 0,
  };
  for (const p of linhas) {
    if (p.status === 'aguardando_pagamento') {
      r.aguardando.qtd++;
      r.aguardando.valor += Number(p.valor_total);
    } else if (PAGO.includes(p.status)) {
      r.pagos.qtd++;
      r.pagos.valor += Number(p.valor_total);
      r.comissaoLiquida += Number(p.valor_comissao) - Number(p.valor_desconto);
      r.aRepassar += Number(p.valor_itens);
      r.tarifas += p.pagamento
        .filter((pg) => PAGAMENTO_COM_DINHEIRO.includes(pg.status))
        .reduce((s, pg) => s + Number(pg.valor_tarifa ?? 0), 0);
    } else if (p.status === 'expirado' || p.status === 'cancelado') {
      r.encerrados++;
    }
  }
  r.margem = r.comissaoLiquida - r.tarifas;
  return r;
}

function chaveOrdenacao(p: PedidoLinha, sort: Ordenacao): string | number {
  switch (sort) {
    case 'numero': return p.numero;
    case 'cliente': return (p.cliente?.name ?? '').toLocaleLowerCase('pt-BR');
    case 'gestor': return (p.gestor?.name ?? '').toLocaleLowerCase('pt-BR');
    case 'data_passeio': return p.reserva?.data_reserva ?? '';
    case 'valor_total': return Number(p.valor_total);
    case 'status': return p.status;
    default: return p.criado_em;
  }
}

export async function buscarPedidos(
  f: FiltrosPedidos,
): Promise<{ linhas: PedidoLinha[]; indicadores: IndicadoresPedidos; truncado: boolean }> {
  const vazio = { linhas: [], indicadores: calcularIndicadores([]), truncado: false };

  let query = supabaseAdmin.from('pedido').select(SELECT);
  if (f.q) {
    const clausulas = await clausulasDaBusca(f.q);
    if (!clausulas.length) return vazio;
    query = query.or(clausulas.join(','));
  }
  if (f.status) query = query.eq('status', f.status);
  if (f.de) query = query.gte('criado_em', `${f.de}T00:00:00-03:00`);
  if (f.ate) query = query.lte('criado_em', `${f.ate}T23:59:59-03:00`);

  const { data, error } = await query.order('criado_em', { ascending: false }).limit(LIMITE);
  if (error) {
    console.error('[admin/pedidos] falha na consulta', error.message);
    return vazio;
  }

  let linhas = (data ?? []) as unknown as PedidoLinha[];
  // Forma de pagamento: pedidos com ao menos uma tentativa nessa forma.
  if (f.forma) linhas = linhas.filter((p) => p.pagamento.some((pg) => pg.forma_pagamento === f.forma));

  linhas.sort((a, b) => {
    const ka = chaveOrdenacao(a, f.sort);
    const kb = chaveOrdenacao(b, f.sort);
    const cmp = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb), 'pt-BR');
    return f.asc ? cmp : -cmp;
  });

  return { linhas, indicadores: calcularIndicadores(linhas), truncado: (data ?? []).length >= LIMITE };
}
