import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { hojeISO, partesNoFuso } from '@/lib/datas';
import { ehUuid } from '@/lib/upload-imagem-server';
import type { Database } from '@/types/supabase';

/**
 * Relatórios contábeis e conciliação do admin (SPEC §101). A fonte é o ledger de partidas
 * dobradas (`lancamento_lote` + `lancamento_financeiro`); a conciliação confronta o ledger com
 * os pagamentos, os pedidos e os repasses.
 */

export const ABAS_RELATORIOS = ['demonstrativo', 'balancete', 'razao', 'conciliacao'] as const;
export type AbaRelatorio = (typeof ABAS_RELATORIOS)[number];
export type BaseRelatorio = 'competencia' | 'caixa';

export type FiltrosRelatorio = {
  aba: AbaRelatorio;
  de: string;
  ate: string;
  base: BaseRelatorio;
  gestor: string | null;
  conta: string | null;
  pagina: number;
};

export const POR_PAGINA_RAZAO = 50;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_EXPORT = 20000;

export function lerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosRelatorio {
  const um = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const { ano, mes } = partesNoFuso(new Date());
  const inicioMes = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  const de = DATA.test(um('de')) ? um('de') : inicioMes;
  const ate = DATA.test(um('ate')) ? um('ate') : hojeISO();
  return {
    aba: ABAS_RELATORIOS.find((a) => a === um('aba')) ?? 'demonstrativo',
    de: de <= ate ? de : ate,
    ate,
    base: um('base') === 'caixa' ? 'caixa' : 'competencia',
    gestor: ehUuid(um('gestor')) ? um('gestor') : null,
    conta: /^\d\.\d\.\d{2}$/.test(um('conta')) ? um('conta') : null,
    pagina: Math.max(1, parseInt(um('pagina'), 10) || 1),
  };
}

type Conta = Database['public']['Tables']['conta_contabil']['Row'];

export async function listarContas(): Promise<Conta[]> {
  const { data } = await supabaseAdmin.from('conta_contabil').select('*').order('codigo');
  return data ?? [];
}

async function nomesDosGestores(ids: string[]): Promise<Map<string, { nome: string; documento: string | null }>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('users').select('id, name, cpf_cnpj').in('id', ids);
  return new Map((data ?? []).map((u) => [u.id, { nome: u.name ?? '—', documento: u.cpf_cnpj ?? null }]));
}

// ─── Demonstrativo ────────────────────────────────────────────────────────

export type LinhaDemonstrativo = {
  gestor_id: string; nome: string; documento: string | null;
  pedidos: number; bruto: number; tarifa: number; desconto: number; comissao: number; devido: number; repassado: number;
};

export async function carregarDemonstrativo(f: FiltrosRelatorio) {
  const { data, error } = await supabaseAdmin.rpc('demonstrativo_gestores', { p_de: f.de, p_ate: f.ate, p_base: f.base });
  if (error) throw new Error(`Falha ao montar o demonstrativo: ${error.message}`);
  const rows = (data ?? []).filter((r) => !f.gestor || r.gestor_id === f.gestor);
  const nomes = await nomesDosGestores(rows.map((r) => r.gestor_id));
  const linhas: LinhaDemonstrativo[] = rows
    .map((r) => ({
      gestor_id: r.gestor_id,
      nome: nomes.get(r.gestor_id)?.nome ?? '—',
      documento: nomes.get(r.gestor_id)?.documento ?? null,
      pedidos: Number(r.pedidos), bruto: Number(r.bruto), tarifa: Number(r.tarifa), desconto: Number(r.desconto),
      comissao: Number(r.comissao), devido: Number(r.devido), repassado: Number(r.repassado),
    }))
    .sort((a, b) => b.bruto - a.bruto);

  const soma = (k: keyof Omit<LinhaDemonstrativo, 'gestor_id' | 'nome' | 'documento'>) => linhas.reduce((s, l) => s + l[k], 0);
  const totais = {
    pedidos: soma('pedidos'), bruto: soma('bruto'), tarifa: soma('tarifa'), desconto: soma('desconto'),
    comissao: soma('comissao'), devido: soma('devido'), repassado: soma('repassado'),
  };

  // Saldo acumulado a repassar (todo o histórico, base caixa) — não depende do período escolhido.
  const { data: acumulado } = await supabaseAdmin.rpc('balancete', { p_de: '2000-01-01', p_ate: hojeISO(), p_base: 'caixa' });
  const saldoObrigacoes = Number(acumulado?.find((c) => c.conta_codigo === '2.1.01')?.saldo ?? 0);
  return { linhas, totais, saldoObrigacoes };
}

// ─── Balancete ────────────────────────────────────────────────────────────

export async function carregarBalancete(f: FiltrosRelatorio) {
  const { data, error } = await supabaseAdmin.rpc('balancete', { p_de: f.de, p_ate: f.ate, p_base: f.base });
  if (error) throw new Error(`Falha ao montar o balancete: ${error.message}`);
  const contas = (data ?? []).map((c) => ({
    ...c, debitos: Number(c.debitos), creditos: Number(c.creditos), saldo: Number(c.saldo),
  }));
  const debitos = contas.reduce((s, c) => s + c.debitos, 0);
  const creditos = contas.reduce((s, c) => s + c.creditos, 0);
  return { contas, debitos, creditos, fecha: Math.abs(debitos - creditos) < 0.005 };
}

// ─── Razão ────────────────────────────────────────────────────────────────

export type LinhaRazao = {
  lote_id: string; data_competencia: string; data_caixa: string; tipo: string; descricao: string | null;
  pedido_numero: number | null; repasse_numero: number | null; gestor_nome: string; gestor_documento: string | null;
  conta_codigo: string; conta_nome: string; codigo_contabilidade: string | null; natureza: 'D' | 'C'; valor: number;
};

type LoteRow = Database['public']['Tables']['lancamento_lote']['Row'];

async function montarRazao(lotes: LoteRow[], conta: string | null): Promise<LinhaRazao[]> {
  if (lotes.length === 0) return [];
  const [{ data: partidas }, contas, nomes, { data: pedidos }, { data: repasses }] = await Promise.all([
    supabaseAdmin.from('lancamento_financeiro').select('lote_id, conta_codigo, natureza, valor').in('lote_id', lotes.map((l) => l.id)),
    listarContas(),
    nomesDosGestores([...new Set(lotes.map((l) => l.gestor_id).filter((x): x is string => !!x))]),
    supabaseAdmin.from('pedido').select('id, numero').in('id', [...new Set(lotes.map((l) => l.pedido_id).filter((x): x is string => !!x))]),
    supabaseAdmin.from('repasse').select('id, numero').in('id', [...new Set(lotes.map((l) => l.repasse_id).filter((x): x is string => !!x))]),
  ]);
  const porConta = new Map(contas.map((c) => [c.codigo, c]));
  const numPedido = new Map((pedidos ?? []).map((p) => [p.id, Number(p.numero)]));
  const numRepasse = new Map((repasses ?? []).map((r) => [r.id, Number(r.numero)]));
  const porLote = new Map<string, NonNullable<typeof partidas>>();
  for (const p of partidas ?? []) porLote.set(p.lote_id, [...(porLote.get(p.lote_id) ?? []), p]);

  return lotes.flatMap((l) =>
    (porLote.get(l.id) ?? [])
      .filter((p) => !conta || p.conta_codigo === conta)
      .sort((a, b) => (a.natureza === b.natureza ? a.conta_codigo.localeCompare(b.conta_codigo) : a.natureza === 'D' ? -1 : 1))
      .map((p) => ({
        lote_id: l.id, data_competencia: l.data_competencia, data_caixa: l.data_caixa, tipo: l.tipo, descricao: l.descricao,
        pedido_numero: l.pedido_id ? numPedido.get(l.pedido_id) ?? null : null,
        repasse_numero: l.repasse_id ? numRepasse.get(l.repasse_id) ?? null : null,
        gestor_nome: l.gestor_id ? nomes.get(l.gestor_id)?.nome ?? '—' : '—',
        gestor_documento: l.gestor_id ? nomes.get(l.gestor_id)?.documento ?? null : null,
        conta_codigo: p.conta_codigo,
        conta_nome: porConta.get(p.conta_codigo)?.nome ?? p.conta_codigo,
        codigo_contabilidade: porConta.get(p.conta_codigo)?.codigo_contabilidade ?? null,
        natureza: p.natureza,
        valor: Number(p.valor),
      })),
  );
}

/** Lotes do período (com filtro de gestor/conta), do mais recente ao mais antigo. */
async function lotesDoPeriodo(f: FiltrosRelatorio, paginar: boolean) {
  const campo = f.base === 'caixa' ? 'data_caixa' : 'data_competencia';
  let q = supabaseAdmin
    .from('lancamento_lote')
    .select('*', { count: 'exact' })
    .gte(campo, f.de)
    .lte(campo, f.ate)
    .order(campo, { ascending: false })
    .order('criado_em', { ascending: false });
  if (f.gestor) q = q.eq('gestor_id', f.gestor);
  if (f.conta) {
    const { data: ids } = await supabaseAdmin.from('lancamento_financeiro').select('lote_id').eq('conta_codigo', f.conta).limit(LIMITE_EXPORT);
    const lista = [...new Set((ids ?? []).map((i) => i.lote_id))];
    if (lista.length === 0) return { lotes: [] as LoteRow[], total: 0 };
    q = q.in('id', lista);
  }
  q = paginar ? q.range((f.pagina - 1) * POR_PAGINA_RAZAO, f.pagina * POR_PAGINA_RAZAO - 1) : q.limit(LIMITE_EXPORT);
  const { data, count, error } = await q;
  if (error) throw new Error(`Falha ao ler o razão: ${error.message}`);
  return { lotes: data ?? [], total: count ?? 0 };
}

export async function carregarRazao(f: FiltrosRelatorio) {
  const { lotes, total } = await lotesDoPeriodo(f, true);
  return { linhas: await montarRazao(lotes, f.conta), total };
}

export async function razaoCompleto(f: FiltrosRelatorio): Promise<LinhaRazao[]> {
  const { lotes } = await lotesDoPeriodo(f, false);
  return montarRazao(lotes, f.conta);
}

// ─── Detalhe por pedido (planilha para o contador) ────────────────────────

export async function detalhePedidosPeriodo(f: FiltrosRelatorio) {
  // Competência = data do passeio; caixa = data em que o Asaas liquidou.
  let q = supabaseAdmin.from('pedido_repasse_situacao').select('*').limit(LIMITE_EXPORT);
  if (f.gestor) q = q.eq('gestor_id', f.gestor);
  q = f.base === 'caixa'
    ? q.gte('recebido_em', `${f.de}T00:00:00-03:00`).lte('recebido_em', `${f.ate}T23:59:59.999-03:00`)
    : q.gte('fim_passeio', f.de).lte('fim_passeio', f.ate);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao ler os pedidos: ${error.message}`);
  const linhas = data ?? [];
  const usuarios = [...new Set(linhas.flatMap((l) => [l.gestor_id, l.cliente_id]))];
  const reservas = [...new Set(linhas.map((l) => l.reserva_id).filter((x): x is string => !!x))];
  const [nomes, { data: rs }, { data: us }] = await Promise.all([
    nomesDosGestores(usuarios),
    reservas.length ? supabaseAdmin.from('reserva').select('id, item_nome').in('id', reservas) : Promise.resolve({ data: [] as { id: string; item_nome: string }[] }),
    usuarios.length ? supabaseAdmin.from('users').select('id, email').in('id', usuarios) : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
  ]);
  const item = new Map((rs ?? []).map((r) => [r.id, r.item_nome]));
  const email = new Map((us ?? []).map((u) => [u.id, u.email ?? '']));
  return linhas
    .sort((a, b) => a.numero - b.numero)
    .map((l) => ({
      ...l,
      gestor_nome: nomes.get(l.gestor_id)?.nome ?? '—',
      gestor_documento: nomes.get(l.gestor_id)?.documento ?? null,
      cliente_nome: nomes.get(l.cliente_id)?.nome ?? '—',
      cliente_documento: nomes.get(l.cliente_id)?.documento ?? null,
      cliente_email: email.get(l.cliente_id) ?? '',
      item_nome: (l.reserva_id && item.get(l.reserva_id)) || '—',
    }));
}

// ─── Conciliação ──────────────────────────────────────────────────────────

export type ItemConciliacao = {
  chave: string;
  titulo: string;
  ok: boolean;
  resumo: string;
  /** Linhas para o admin agir (pedidos/repasses com problema). */
  itens: { rotulo: string; href: string; detalhe: string }[];
};

const centavos = (v: number) => Math.round(v * 100);

export async function carregarConciliacao(): Promise<ItemConciliacao[]> {
  const [{ data: pagRec }, { data: lotesRec }, { data: balanco }, { data: abertos }, { data: semComprovante }, { data: recuperar }] = await Promise.all([
    supabaseAdmin.from('pagamento').select('id, pedido_id, valor, valor_liquido, recebido_em, numero_parcelas').eq('status', 'recebido').limit(LIMITE_EXPORT),
    supabaseAdmin.from('lancamento_lote').select('pagamento_id, pedido_id').eq('tipo', 'recebimento').limit(LIMITE_EXPORT),
    supabaseAdmin.rpc('balancete', { p_de: '2000-01-01', p_ate: '2100-12-31', p_base: 'caixa' }),
    supabaseAdmin
      .from('pedido_repasse_situacao')
      .select('pedido_id, numero, situacao, valor_repassar')
      .in('situacao', ['a_repassar', 'aguardando_prazo', 'aguardando_passeio', 'aguardando_recebimento', 'retido', 'reembolsado'])
      .limit(LIMITE_EXPORT),
    supabaseAdmin.from('repasse').select('id, numero, valor_total, pago_em').eq('status', 'pago').is('comprovante_key', null).order('pago_em', { ascending: false }).limit(200),
    supabaseAdmin
      .from('pedido_repasse_situacao')
      .select('pedido_id, numero, pedido_status, valor_repassar, repasse_numero')
      .eq('situacao', 'repassado')
      .in('pedido_status', ['reembolsado', 'reembolsado_parcial', 'em_disputa'])
      .limit(500),
  ]);

  const itens: ItemConciliacao[] = [];
  const lancados = new Set((lotesRec ?? []).map((l) => l.pagamento_id));
  const pedidosLancados = new Set((lotesRec ?? []).map((l) => l.pedido_id));
  const conta = new Map((balanco ?? []).map((c) => [c.conta_codigo, c]));

  // 1. Pagamento recebido sem lançamento.
  const semLancamento = (pagRec ?? []).filter((p) => !lancados.has(p.id));
  const { data: pedSem } = semLancamento.length
    ? await supabaseAdmin.from('pedido').select('id, numero, status').in('id', semLancamento.map((p) => p.pedido_id))
    : { data: [] as { id: string; numero: number; status: string }[] };
  const pedidoSem = new Map((pedSem ?? []).map((p) => [p.id, p]));
  itens.push({
    chave: 'sem_lancamento',
    titulo: 'Pagamentos recebidos sem lançamento contábil',
    ok: semLancamento.length === 0,
    resumo: semLancamento.length === 0
      ? 'Todo pagamento recebido no Asaas tem o seu lançamento.'
      : `${semLancamento.length} pagamento(s) recebido(s) ainda sem lançamento (pedido encerrado, valor líquido ausente ou falha no webhook). Sincronize o pedido para tentar de novo.`,
    itens: semLancamento.slice(0, 50).map((p) => {
      const ped = pedidoSem.get(p.pedido_id);
      return {
        rotulo: `Pedido #${ped?.numero ?? '—'}`,
        href: `/administrator/pedidos/${p.pedido_id}`,
        detalhe: ped && ped.status !== 'pago' ? `pedido ${ped.status}: dinheiro recebido sem obrigação com o gestor — provável estorno manual` : p.valor_liquido == null ? 'sem valor líquido' : 'não lançado',
      };
    }),
  });

  // 2. Líquido recebido × saldo no Asaas do ledger.
  const liquidoPagamentos = (pagRec ?? []).filter((p) => lancados.has(p.id)).reduce((s, p) => s + Number(p.valor_liquido ?? 0), 0);
  const liquidoLedger = Number(conta.get('1.1.01')?.debitos ?? 0);
  itens.push({
    chave: 'liquido',
    titulo: 'Valor líquido recebido (pagamentos × ledger)',
    ok: centavos(liquidoPagamentos) === centavos(liquidoLedger),
    resumo: `Pagamentos: R$ ${liquidoPagamentos.toFixed(2)} · ledger (Saldo Asaas, débitos): R$ ${liquidoLedger.toFixed(2)}.`,
    itens: [],
  });

  // 3. Obrigações com gestores: ledger × pedidos em aberto.
  const emAberto = (abertos ?? []).filter((p) => pedidosLancados.has(p.pedido_id));
  const esperado = emAberto.reduce((s, p) => s + Number(p.valor_repassar), 0);
  const obrigacoes = Number(conta.get('2.1.01')?.saldo ?? 0);
  const reembolsados = emAberto.filter((p) => p.situacao === 'reembolsado');
  itens.push({
    chave: 'obrigacoes',
    titulo: 'Obrigações com gestores (ledger × pedidos a repassar)',
    ok: centavos(obrigacoes) === centavos(esperado),
    resumo: `Ledger: R$ ${obrigacoes.toFixed(2)} · pedidos pagos ainda não repassados: R$ ${esperado.toFixed(2)}.`
      + (reembolsados.length ? ` ${reembolsados.length} pedido(s) reembolsado(s) ainda constam como obrigação (o estorno contábil entra com o fluxo de reembolsos).` : ''),
    itens: reembolsados.slice(0, 50).map((p) => ({
      rotulo: `Pedido #${p.numero}`, href: `/administrator/pedidos/${p.pedido_id}`, detalhe: 'reembolsado, mas a obrigação com o gestor segue no ledger',
    })),
  });

  // 4. Débitos = créditos.
  const deb = (balanco ?? []).reduce((s, c) => s + Number(c.debitos), 0);
  const cred = (balanco ?? []).reduce((s, c) => s + Number(c.creditos), 0);
  itens.push({
    chave: 'partidas',
    titulo: 'Partidas dobradas (débitos = créditos)',
    ok: centavos(deb) === centavos(cred),
    resumo: `Débitos: R$ ${deb.toFixed(2)} · créditos: R$ ${cred.toFixed(2)}.`,
    itens: [],
  });

  // 5. Repasses sem comprovante.
  itens.push({
    chave: 'sem_comprovante',
    titulo: 'Repasses pagos sem comprovante',
    ok: (semComprovante ?? []).length === 0,
    resumo: (semComprovante ?? []).length === 0 ? 'Todos os repasses pagos têm comprovante anexado.' : `${semComprovante!.length} repasse(s) sem comprovante.`,
    itens: (semComprovante ?? []).map((r) => ({
      rotulo: `Repasse #${r.numero}`, href: `/administrator/financeiro/repasses/${r.id}`, detalhe: `R$ ${Number(r.valor_total).toFixed(2)} pago em ${r.pago_em.slice(0, 10).split('-').reverse().join('/')}`,
    })),
  });

  // 6. Pedido repassado e depois reembolsado/em disputa.
  itens.push({
    chave: 'recuperar',
    titulo: 'Repasses a recuperar (pedido reembolsado ou em disputa após o repasse)',
    ok: (recuperar ?? []).length === 0,
    resumo: (recuperar ?? []).length === 0 ? 'Nenhum pedido repassado foi reembolsado ou contestado.' : `${recuperar!.length} pedido(s) já repassado(s) com reembolso ou disputa: o Boatzy pode precisar recuperar o valor com o gestor.`,
    itens: (recuperar ?? []).map((p) => ({
      rotulo: `Pedido #${p.numero}`, href: `/administrator/pedidos/${p.pedido_id}`, detalhe: `${p.pedido_status.replace('_', ' ')} · repasse #${p.repasse_numero} · R$ ${Number(p.valor_repassar).toFixed(2)}`,
    })),
  });

  return itens;
}
