import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { partesNoFuso } from '@/lib/datas';
import { ehUuid } from '@/lib/upload-imagem-server';
import { METODOS_REPASSE } from '@/lib/repasses/rotulos';
import type { Database, RepasseMetodo, SituacaoRepasse } from '@/types/supabase';

/**
 * Consultas do admin → Financeiro → Repasses (SPEC §101). A regra de elegibilidade vive na view
 * `pedido_repasse_situacao`; aqui só se lê, agrupa e enriquece com nomes.
 */

export const ABAS_REPASSES = ['liberados', 'aguardando', 'retidos', 'repassados'] as const;
export type AbaRepasses = (typeof ABAS_REPASSES)[number];

export const PAGE_SIZES = [25, 50, 100] as const;

/** Teto de linhas lidas da view por consulta (a tela avisa quando é atingido). */
const LIMITE = 3000;

type LinhaView = Database['public']['Views']['pedido_repasse_situacao']['Row'];
type Recebimento = Database['public']['Tables']['gestor_recebimento']['Row'];
type Repasse = Database['public']['Tables']['repasse']['Row'];

export type PedidoFila = LinhaView & {
  gestor_nome: string;
  cliente_nome: string;
  item_nome: string;
};

export type GestorResumo = {
  id: string;
  nome: string;
  email: string | null;
  cpf_cnpj: string | null;
};

export type GrupoGestor = {
  gestor: GestorResumo;
  recebimento: Recebimento | null;
  /** O titular do destino é outro CPF/CNPJ que o do cadastro do gestor (conferir antes de pagar). */
  titularDiferente: boolean;
  pedidos: PedidoFila[];
  total: number;
};

export type FiltrosRepasses = {
  aba: AbaRepasses;
  gestor: string | null;
  de: string | null;
  ate: string | null;
  metodo: RepasseMetodo | null;
  semComprovante: boolean;
  pagina: number;
  porPagina: (typeof PAGE_SIZES)[number];
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function lerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosRepasses {
  const um = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const aba = ABAS_REPASSES.find((a) => a === um('aba')) ?? 'liberados';
  const porPagina = PAGE_SIZES.find((n) => String(n) === um('por')) ?? PAGE_SIZES[0];
  const metodo = METODOS_REPASSE.find((m) => m === um('metodo')) ?? null;
  return {
    aba,
    gestor: ehUuid(um('gestor')) ? um('gestor') : null,
    de: DATA.test(um('de')) ? um('de') : null,
    ate: DATA.test(um('ate')) ? um('ate') : null,
    metodo,
    semComprovante: um('sem_comprovante') === '1',
    pagina: Math.max(1, parseInt(um('pagina'), 10) || 1),
    porPagina,
  };
}

const somenteDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** Gestores, clientes e itens dos pedidos (nomes para a tela), em lote. */
async function enriquecer(linhas: LinhaView[]): Promise<PedidoFila[]> {
  if (linhas.length === 0) return [];
  const usuarios = [...new Set(linhas.flatMap((l) => [l.gestor_id, l.cliente_id]))];
  const reservas = [...new Set(linhas.map((l) => l.reserva_id).filter((x): x is string => !!x))];
  const [{ data: us }, { data: rs }] = await Promise.all([
    supabaseAdmin.from('users').select('id, name').in('id', usuarios),
    reservas.length
      ? supabaseAdmin.from('reserva').select('id, item_nome').in('id', reservas)
      : Promise.resolve({ data: [] as { id: string; item_nome: string }[] }),
  ]);
  const nome = new Map((us ?? []).map((u) => [u.id, u.name ?? '—']));
  const item = new Map((rs ?? []).map((r) => [r.id, r.item_nome]));
  return linhas.map((l) => ({
    ...l,
    gestor_nome: nome.get(l.gestor_id) ?? '—',
    cliente_nome: nome.get(l.cliente_id) ?? '—',
    item_nome: (l.reserva_id && item.get(l.reserva_id)) || '—',
  }));
}

async function pedidosPorSituacao(situacoes: SituacaoRepasse[], gestor: string | null) {
  let q = supabaseAdmin
    .from('pedido_repasse_situacao')
    .select('*')
    .in('situacao', situacoes)
    .order('liberado_em', { ascending: true, nullsFirst: false })
    .limit(LIMITE + 1);
  if (gestor) q = q.eq('gestor_id', gestor);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao ler a situação dos repasses: ${error.message}`);
  const truncado = (data?.length ?? 0) > LIMITE;
  return { linhas: await enriquecer((data ?? []).slice(0, LIMITE)), truncado };
}

/** Pedidos liberados, agrupados por gestor, com o destino de recebimento de cada um. */
export async function carregarLiberados(gestor: string | null): Promise<{ grupos: GrupoGestor[]; truncado: boolean }> {
  const { linhas, truncado } = await pedidosPorSituacao(['a_repassar'], gestor);
  const ids = [...new Set(linhas.map((l) => l.gestor_id))];
  if (ids.length === 0) return { grupos: [], truncado };

  const [{ data: gestores }, { data: recebimentos }] = await Promise.all([
    supabaseAdmin.from('users').select('id, name, email, cpf_cnpj').in('id', ids),
    supabaseAdmin.from('gestor_recebimento').select('*').in('owner_id', ids).eq('ativo', true),
  ]);
  const porGestor = new Map((gestores ?? []).map((g) => [g.id, g]));
  const recPor = new Map((recebimentos ?? []).map((r) => [r.owner_id, r]));

  const grupos = ids.map<GrupoGestor>((id) => {
    const g = porGestor.get(id);
    const rec = recPor.get(id) ?? null;
    const pedidos = linhas.filter((l) => l.gestor_id === id);
    return {
      gestor: { id, nome: g?.name ?? '—', email: g?.email ?? null, cpf_cnpj: g?.cpf_cnpj ?? null },
      recebimento: rec,
      titularDiferente: !!rec && !!g?.cpf_cnpj && somenteDigitos(rec.titular_documento) !== somenteDigitos(g.cpf_cnpj),
      pedidos,
      total: pedidos.reduce((s, p) => s + Number(p.valor_repassar), 0),
    };
  });
  grupos.sort((a, b) => b.total - a.total);
  return { grupos, truncado };
}

export async function carregarFilaSimples(aba: 'aguardando' | 'retidos', gestor: string | null) {
  const situacoes: SituacaoRepasse[] = aba === 'aguardando'
    ? ['aguardando_prazo', 'aguardando_passeio', 'aguardando_recebimento']
    : ['retido'];
  return pedidosPorSituacao(situacoes, gestor);
}

export type IndicadoresRepasses = {
  aRepassar: { valor: number; pedidos: number; gestores: number };
  aguardando: { valor: number; pedidos: number };
  retido: { valor: number; pedidos: number };
  repassadoMes: { valor: number; repasses: number };
  semDestino: number;
};

export async function carregarIndicadores(): Promise<IndicadoresRepasses> {
  const { ano, mes } = partesNoFuso(new Date());
  const inicioMes = new Date(Date.UTC(ano, mes, 1, 3)).toISOString(); // 00:00 de Brasília (UTC−3)

  const [{ data: abertos }, { data: lotes }] = await Promise.all([
    supabaseAdmin
      .from('pedido_repasse_situacao')
      .select('situacao, valor_repassar, gestor_id')
      .in('situacao', ['a_repassar', 'aguardando_prazo', 'aguardando_passeio', 'aguardando_recebimento', 'retido'])
      .limit(LIMITE * 3),
    supabaseAdmin.from('repasse').select('valor_total').eq('status', 'pago').gte('pago_em', inicioMes),
  ]);

  const r: IndicadoresRepasses = {
    aRepassar: { valor: 0, pedidos: 0, gestores: 0 },
    aguardando: { valor: 0, pedidos: 0 },
    retido: { valor: 0, pedidos: 0 },
    repassadoMes: { valor: (lotes ?? []).reduce((s, l) => s + Number(l.valor_total), 0), repasses: lotes?.length ?? 0 },
    semDestino: 0,
  };
  const liberados = new Set<string>();
  for (const l of abertos ?? []) {
    const v = Number(l.valor_repassar);
    if (l.situacao === 'a_repassar') { r.aRepassar.valor += v; r.aRepassar.pedidos += 1; liberados.add(l.gestor_id); }
    else if (l.situacao === 'retido') { r.retido.valor += v; r.retido.pedidos += 1; }
    else { r.aguardando.valor += v; r.aguardando.pedidos += 1; }
  }
  r.aRepassar.gestores = liberados.size;
  if (liberados.size > 0) {
    const { data: comDestino } = await supabaseAdmin
      .from('gestor_recebimento').select('owner_id').in('owner_id', [...liberados]).eq('ativo', true);
    r.semDestino = liberados.size - new Set((comDestino ?? []).map((c) => c.owner_id)).size;
  }
  return r;
}

export type RepasseLinha = Repasse & { gestor_nome: string; gestor_documento: string | null; itens: number };

/** Lotes de repasse (aba "Repassados") com filtros e paginação no banco. */
export async function carregarRepasses(f: FiltrosRepasses, paginar = true): Promise<{ linhas: RepasseLinha[]; total: number }> {
  let q = supabaseAdmin
    .from('repasse')
    .select('*', { count: 'exact' })
    .order('pago_em', { ascending: false });
  if (f.gestor) q = q.eq('gestor_id', f.gestor);
  if (f.metodo) q = q.eq('metodo', f.metodo);
  if (f.de) q = q.gte('pago_em', `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte('pago_em', `${f.ate}T23:59:59.999-03:00`);
  if (f.semComprovante) q = q.is('comprovante_key', null).eq('status', 'pago');
  q = paginar ? q.range((f.pagina - 1) * f.porPagina, f.pagina * f.porPagina - 1) : q.limit(LIMITE);

  const { data, count, error } = await q;
  if (error) throw new Error(`Falha ao ler os repasses: ${error.message}`);
  const lotes = data ?? [];
  if (lotes.length === 0) return { linhas: [], total: count ?? 0 };

  const [{ data: us }, { data: itens }] = await Promise.all([
    supabaseAdmin.from('users').select('id, name, cpf_cnpj').in('id', [...new Set(lotes.map((l) => l.gestor_id))]),
    supabaseAdmin.from('repasse_item').select('repasse_id').in('repasse_id', lotes.map((l) => l.id)),
  ]);
  const gestor = new Map((us ?? []).map((u) => [u.id, u]));
  const contagem = new Map<string, number>();
  for (const i of itens ?? []) contagem.set(i.repasse_id, (contagem.get(i.repasse_id) ?? 0) + 1);

  return {
    linhas: lotes.map((l) => ({
      ...l,
      gestor_nome: gestor.get(l.gestor_id)?.name ?? '—',
      gestor_documento: gestor.get(l.gestor_id)?.cpf_cnpj ?? null,
      itens: contagem.get(l.id) ?? 0,
    })),
    total: count ?? 0,
  };
}

/** Gestores que têm algo na fila ou já receberam (opções do filtro). */
export async function listarGestoresDosRepasses(): Promise<{ id: string; nome: string }[]> {
  const [{ data: a }, { data: b }] = await Promise.all([
    supabaseAdmin.from('pedido_repasse_situacao').select('gestor_id').limit(LIMITE),
    supabaseAdmin.from('repasse').select('gestor_id').limit(LIMITE),
  ]);
  const ids = [...new Set([...(a ?? []), ...(b ?? [])].map((x) => x.gestor_id))];
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin.from('users').select('id, name').in('id', ids).order('name');
  return (data ?? []).map((u) => ({ id: u.id, nome: u.name ?? '—' }));
}
