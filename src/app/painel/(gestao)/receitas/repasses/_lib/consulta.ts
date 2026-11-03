import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Database, SituacaoRepasse } from '@/types/supabase';

/**
 * Consultas do gestor sobre os repasses que o Boatzy lhe faz (SPEC §101). Sempre filtradas
 * pelo `gestor_id` da sessão: o gestor só enxerga o que é dele, e só o valor dos itens (nunca
 * a tarifa do Asaas nem a comissão).
 */

type LinhaView = Database['public']['Views']['pedido_repasse_situacao']['Row'];

export const ABAS_GESTOR = ['todos', 'aguardando', 'liberado', 'pago'] as const;
export type AbaGestor = (typeof ABAS_GESTOR)[number];

const SITUACOES_ABA: Record<Exclude<AbaGestor, 'todos'>, SituacaoRepasse[]> = {
  aguardando: ['aguardando_passeio', 'aguardando_prazo', 'aguardando_recebimento'],
  liberado: ['a_repassar'],
  pago: ['repassado'],
};

export type TotaisRepasse = { aguardando: number; liberado: number; pago: number; temRecebimento: boolean };

export async function totaisDeRepasse(gestorId: string): Promise<TotaisRepasse> {
  const [{ data: abertos }, { data: lotes }, { count }] = await Promise.all([
    supabaseAdmin
      .from('pedido_repasse_situacao')
      .select('situacao, valor_repassar')
      .eq('gestor_id', gestorId)
      .in('situacao', ['a_repassar', 'aguardando_prazo', 'aguardando_passeio', 'aguardando_recebimento'])
      .limit(5000),
    supabaseAdmin.from('repasse').select('valor_total').eq('gestor_id', gestorId).eq('status', 'pago').limit(5000),
    supabaseAdmin.from('gestor_recebimento').select('id', { count: 'exact', head: true }).eq('owner_id', gestorId).eq('ativo', true),
  ]);
  const t: TotaisRepasse = { aguardando: 0, liberado: 0, pago: 0, temRecebimento: (count ?? 0) > 0 };
  for (const l of abertos ?? []) {
    if (l.situacao === 'a_repassar') t.liberado += Number(l.valor_repassar);
    else t.aguardando += Number(l.valor_repassar);
  }
  t.pago = (lotes ?? []).reduce((s, l) => s + Number(l.valor_total), 0);
  return t;
}

export type PedidoDoGestor = Pick<
  LinhaView,
  'pedido_id' | 'numero' | 'tipo' | 'situacao' | 'valor_repassar' | 'fim_passeio' | 'liberado_em' | 'repasse_id' | 'repasse_numero' | 'repasse_pago_em'
> & { item_nome: string; cliente_nome: string };

export async function carregarPedidosDoGestor(gestorId: string, aba: AbaGestor): Promise<{ linhas: PedidoDoGestor[]; truncado: boolean }> {
  const LIMITE = 500;
  let q = supabaseAdmin
    .from('pedido_repasse_situacao')
    .select('pedido_id, numero, tipo, situacao, valor_repassar, fim_passeio, liberado_em, repasse_id, repasse_numero, repasse_pago_em, reserva_id, cliente_id')
    .eq('gestor_id', gestorId)
    .order('fim_passeio', { ascending: false, nullsFirst: false })
    .limit(LIMITE + 1);
  if (aba !== 'todos') q = q.in('situacao', SITUACOES_ABA[aba]);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao ler os repasses: ${error.message}`);

  const linhas = (data ?? []).slice(0, LIMITE);
  const reservas = [...new Set(linhas.map((l) => l.reserva_id).filter((x): x is string => !!x))];
  const clientes = [...new Set(linhas.map((l) => l.cliente_id))];
  const [{ data: rs }, { data: cs }] = await Promise.all([
    reservas.length ? supabaseAdmin.from('reserva').select('id, item_nome').in('id', reservas) : Promise.resolve({ data: [] as { id: string; item_nome: string }[] }),
    clientes.length ? supabaseAdmin.from('users').select('id, name').in('id', clientes) : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
  ]);
  const item = new Map((rs ?? []).map((r) => [r.id, r.item_nome]));
  const cliente = new Map((cs ?? []).map((c) => [c.id, c.name ?? 'Cliente']));
  return {
    truncado: (data?.length ?? 0) > LIMITE,
    linhas: linhas.map(({ reserva_id, cliente_id, ...l }) => ({
      ...l,
      item_nome: (reserva_id && item.get(reserva_id)) || '—',
      cliente_nome: cliente.get(cliente_id) ?? 'Cliente',
    })),
  };
}

/** Repasses pagos ao gestor (mais recentes primeiro). */
export async function carregarRepassesDoGestor(gestorId: string) {
  const { data, error } = await supabaseAdmin
    .from('repasse')
    .select('id, numero, valor_total, metodo, pago_em, comprovante_key, destino_snapshot')
    .eq('gestor_id', gestorId)
    .eq('status', 'pago')
    .order('pago_em', { ascending: false })
    .limit(200);
  if (error) throw new Error(`Falha ao ler os repasses: ${error.message}`);
  return data ?? [];
}
