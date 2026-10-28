import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { getTaxaEfetiva } from '@/lib/taxas';
import { getFinanceiroConfig, getFormasPagamento, type FinanceiroConfig } from '@/lib/financeiro/config';
import { hojeISO } from '@/lib/datas';
import { somarDiasISO } from '@/lib/precos-calendario';
import type { FormaPagamentoCodigo, Json, PedidoItemOrigem, PedidoItemTipo, PedidoStatus } from '@/types/supabase';
import { emailCobrancaAvulsaCancelada, emailCobrancaAvulsaCriada } from './emails';
import { registrarEventoPedido } from './historico';
import { baseEmailPedido, cancelarCobrancasPendentes, dadosParaEmail, PAGAMENTO_PAGO } from './pedidos';
import {
  arredondarCentavos, calcularValoresAvulso, linhasAvulsoParaCliente, opcoesParcelas, totalItemAvulso, VALOR_MINIMO_COBRANCA,
} from './valores';

/**
 * Cobrança avulsa (SPEC §34.16): depois da reserva confirmada/concluída o
 * gestor cobra do cliente um valor extra (produto/serviço do catálogo ou item
 * livre). É um `pedido` de tipo 'avulso' — pagamento, webhook, expiração e
 * admin são os mesmos do pedido da reserva; a reserva nunca é alterada.
 *
 * Regras (PRD §6.7): só o gestor dono emite; reserva `confirmada`/`concluida`
 * até `avulso_dias_apos_passeio` após o fim do passeio; comissão = taxa da
 * reserva (se `avulso_cobrar_comissao`); formas ⊆ formas ativas; parcelas ≤
 * máximo global; prazo ≤ `avulso_prazo_max_dias`; imutável depois de emitida.
 */

export const MAX_ITENS_AVULSO = 30;
/** Cobranças em aberto ao mesmo tempo na mesma reserva. */
export const MAX_AVULSAS_ABERTAS = 10;

export type ItemAvulsoEntrada = {
  origem: PedidoItemOrigem;
  catalogoId?: string | null;
  tipo: PedidoItemTipo;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type CriarCobrancaAvulsaInput = {
  reservaId: string;
  gestorId: string;
  titulo: string;
  mensagem?: string | null;
  itens: ItemAvulsoEntrada[];
  /** Total que o gestor recebe, se editado (senão = soma dos itens). */
  valorFinal?: number | null;
  motivoAjuste?: string | null;
  formas: FormaPagamentoCodigo[];
  parcelasMax: number;
  prazoHoras: number;
};

type ReservaAvulso = {
  id: string;
  owner_id: string;
  cliente_id: string;
  status: string;
  item_nome: string;
  data_reserva: string;
  data_fim_reserva: string | null;
  taxa_percent: number | null;
};

/** Último dia (Brasília) em que a reserva aceita cobrança avulsa. */
export function limiteEmissaoAvulso(r: { data_reserva: string; data_fim_reserva: string | null }, diasAposPasseio: number): string {
  return somarDiasISO(r.data_fim_reserva ?? r.data_reserva, diasAposPasseio);
}

/** Por que a reserva não aceita cobrança avulsa agora (null = aceita). */
export function motivoBloqueioAvulso(r: Pick<ReservaAvulso, 'status' | 'data_reserva' | 'data_fim_reserva'>, cfg: Pick<FinanceiroConfig, 'avulso_dias_apos_passeio'>): string | null {
  if (r.status !== 'confirmada' && r.status !== 'concluida') {
    return 'Só é possível cobrar à parte em reservas confirmadas ou concluídas.';
  }
  if (hojeISO() > limiteEmissaoAvulso(r, cfg.avulso_dias_apos_passeio)) {
    return `O prazo para emitir cobranças desta reserva terminou (${cfg.avulso_dias_apos_passeio} dias após o passeio).`;
  }
  return null;
}

/** Taxa de serviço da cobrança avulsa: a congelada na reserva (D7) ou a vigente do gestor. */
export async function taxaDaCobrancaAvulsa(r: Pick<ReservaAvulso, 'owner_id' | 'taxa_percent'>, cfg: Pick<FinanceiroConfig, 'avulso_cobrar_comissao'>): Promise<number> {
  if (!cfg.avulso_cobrar_comissao) return 0;
  return r.taxa_percent != null ? Number(r.taxa_percent) : getTaxaEfetiva(r.owner_id);
}

/** Opções do formulário: formas ativas e o máximo de parcelas do cartão (configuração global). */
export async function opcoesFormasAvulso(): Promise<{ codigo: FormaPagamentoCodigo; nome: string; parcelasMax: number; valorMinimoParcela: number | null }[]> {
  const formas = await getFormasPagamento();
  return formas
    .filter((f) => f.ativo)
    .map((f) => ({
      codigo: f.codigo as FormaPagamentoCodigo,
      nome: f.nome,
      parcelasMax: f.codigo === 'cartao_credito' ? f.parcelas_max : 1,
      valorMinimoParcela: f.valor_minimo_parcela != null ? Number(f.valor_minimo_parcela) : null,
    }));
}

function textoLimpo(v: string | null | undefined, max: number): string {
  return (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export type CriarCobrancaAvulsaResultado =
  | { ok: true; pedidoId: string; numero: number }
  | { ok: false; error: string };

export async function criarCobrancaAvulsa(input: CriarCobrancaAvulsaInput): Promise<CriarCobrancaAvulsaResultado> {
  const { data } = await supabaseAdmin
    .from('reserva')
    .select('id, owner_id, cliente_id, status, item_nome, data_reserva, data_fim_reserva, taxa_percent')
    .eq('id', input.reservaId)
    .eq('owner_id', input.gestorId)
    .maybeSingle();
  const reserva = data as ReservaAvulso | null;
  if (!reserva) return { ok: false, error: 'Reserva não encontrada ou sem permissão.' };

  const cfg = await getFinanceiroConfig();
  const bloqueio = motivoBloqueioAvulso(reserva, cfg);
  if (bloqueio) return { ok: false, error: bloqueio };

  const { count: abertas } = await supabaseAdmin
    .from('pedido_avulso')
    .select('pedido_id, pedido!inner ( status )', { count: 'exact', head: true })
    .eq('reserva_id', reserva.id)
    .eq('pedido.status', 'aguardando_pagamento');
  if ((abertas ?? 0) >= MAX_AVULSAS_ABERTAS) {
    return { ok: false, error: `Esta reserva já tem ${MAX_AVULSAS_ABERTAS} cobranças em aberto. Aguarde o pagamento ou cancele alguma.` };
  }

  // Título e itens.
  const titulo = textoLimpo(input.titulo, 120);
  if (titulo.length < 2) return { ok: false, error: 'Informe um título para a cobrança.' };
  if (!input.itens.length) return { ok: false, error: 'Adicione ao menos um item.' };
  if (input.itens.length > MAX_ITENS_AVULSO) return { ok: false, error: `Use no máximo ${MAX_ITENS_AVULSO} itens.` };

  const idsCatalogo = [...new Set(input.itens.filter((i) => i.origem === 'catalogo' && i.catalogoId).map((i) => i.catalogoId!))];
  const catalogo = new Map<string, { tipo: string }>();
  if (idsCatalogo.length) {
    const { data: cat } = await supabaseAdmin.from('catalogo').select('id, tipo').in('id', idsCatalogo).eq('owner_id', input.gestorId);
    for (const c of cat ?? []) catalogo.set(c.id, { tipo: c.tipo });
  }

  const itens: { origem: PedidoItemOrigem; catalogo_id: string | null; tipo: PedidoItemTipo; descricao: string; quantidade: number; valor_unitario: number; valor_total: number }[] = [];
  for (const i of input.itens) {
    const descricao = textoLimpo(i.descricao, 200);
    if (!descricao) return { ok: false, error: 'Todo item precisa de uma descrição.' };
    const quantidade = Math.round(Number(i.quantidade) * 100) / 100;
    const valorUnitario = arredondarCentavos(Number(i.valorUnitario));
    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 9999) return { ok: false, error: `Quantidade inválida em "${descricao}".` };
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) return { ok: false, error: `Valor inválido em "${descricao}".` };

    let tipo: PedidoItemTipo;
    let catalogoId: string | null = null;
    if (i.origem === 'catalogo') {
      const c = i.catalogoId ? catalogo.get(i.catalogoId) : undefined;
      if (!c) return { ok: false, error: `O item "${descricao}" não está no seu catálogo.` };
      catalogoId = i.catalogoId!;
      tipo = c.tipo === 'servico' ? 'servico' : 'produto';
    } else {
      if (!['produto', 'servico', 'taxa', 'outro'].includes(i.tipo)) return { ok: false, error: 'Tipo de item inválido.' };
      tipo = i.tipo;
    }
    itens.push({
      origem: i.origem, catalogo_id: catalogoId, tipo, descricao, quantidade, valor_unitario: valorUnitario,
      valor_total: totalItemAvulso({ quantidade, valorUnitario }),
    });
  }

  // Valores.
  const taxaPercent = await taxaDaCobrancaAvulsa(reserva, cfg);
  const valorFinal = input.valorFinal != null && Number.isFinite(input.valorFinal) ? arredondarCentavos(input.valorFinal) : null;
  const valores = calcularValoresAvulso({
    itens: itens.map((i) => ({ quantidade: i.quantidade, valorUnitario: i.valor_unitario })),
    valorFinal,
    taxaPercent,
  });
  if (valores.valorItens <= 0) return { ok: false, error: 'O valor da cobrança precisa ser maior que zero.' };
  if (valores.valorTotal < VALOR_MINIMO_COBRANCA) {
    return { ok: false, error: `O total precisa ser de pelo menos R$ ${VALOR_MINIMO_COBRANCA},00 para pagamento online.` };
  }
  const motivoAjuste = textoLimpo(input.motivoAjuste, 300);
  if (valores.valorAjuste !== 0 && !motivoAjuste) return { ok: false, error: 'Informe o motivo da alteração do valor.' };

  // Formas e parcelas: só as ativas na configuração global, parcelas até o máximo global.
  const ativas = await opcoesFormasAvulso();
  const formas = [...new Set(input.formas)].filter((f) => ativas.some((a) => a.codigo === f));
  if (!formas.length) return { ok: false, error: 'Selecione ao menos uma forma de pagamento disponível.' };
  let parcelasMax = 1;
  if (formas.includes('cartao_credito')) {
    const cartao = ativas.find((a) => a.codigo === 'cartao_credito')!;
    const permitidas = opcoesParcelas(valores.valorTotal, cartao.parcelasMax, cartao.valorMinimoParcela);
    parcelasMax = Math.trunc(Number(input.parcelasMax)) || 1;
    if (!permitidas.includes(parcelasMax)) return { ok: false, error: 'Número de parcelas indisponível para este valor.' };
  }

  // Prazo.
  const prazoHoras = Math.trunc(Number(input.prazoHoras));
  if (!Number.isFinite(prazoHoras) || prazoHoras < 1 || prazoHoras > cfg.avulso_prazo_max_dias * 24) {
    return { ok: false, error: `O prazo para pagar vai de 1 hora a ${cfg.avulso_prazo_max_dias} dias.` };
  }
  const expiraEm = new Date(Date.now() + prazoHoras * 3_600_000).toISOString();

  const mensagem = textoLimpo(input.mensagem, 1000) || null;
  const { data: criado, error } = await supabaseAdmin.rpc('criar_pedido_avulso', {
    p_reserva_id: reserva.id,
    p_gestor_id: input.gestorId,
    p_titulo: titulo,
    p_mensagem: mensagem,
    p_formas: formas,
    p_parcelas_max: parcelasMax,
    p_valor_calculado: valores.valorCalculado,
    p_valor_ajuste: valores.valorAjuste,
    p_motivo_ajuste: valores.valorAjuste !== 0 ? motivoAjuste : null,
    p_valor_itens: valores.valorItens,
    p_comissao_percentual: taxaPercent,
    p_valor_comissao: valores.valorComissao,
    p_valor_total: valores.valorTotal,
    p_expira_em: expiraEm,
    p_itens: itens as unknown as Json,
  });
  const linha = Array.isArray(criado) ? criado[0] : criado;
  if (error || !linha) {
    console.error('[pagamentos/avulso] falha ao criar cobrança', reserva.id, error?.message);
    if (error?.message?.includes('reserva_status_invalido')) return { ok: false, error: 'A reserva não está mais confirmada.' };
    return { ok: false, error: 'Não foi possível gerar a cobrança. Tente novamente.' };
  }

  // E-mail ao cliente (o aviso no site é gravado pela própria função do banco).
  const [{ data: cliente }, { data: gestor }] = await Promise.all([
    supabaseAdmin.from('users').select('name, email').eq('id', reserva.cliente_id).single(),
    supabaseAdmin.from('users').select('name').eq('id', input.gestorId).single(),
  ]);
  const linhas = linhasAvulsoParaCliente({
    itens: itens.map((i) => i.valor_total),
    valorAjuste: valores.valorAjuste,
    valorItens: valores.valorItens,
    valorTotal: valores.valorTotal,
  });
  await emailCobrancaAvulsaCriada({
    para: cliente?.email ?? '',
    nome: cliente?.name ?? '',
    gestorNome: gestor?.name?.trim() || 'O gestor',
    pedidoId: linha.id,
    pedidoNumero: Number(linha.numero),
    titulo,
    itemNome: reserva.item_nome,
    dataReserva: reserva.data_reserva,
    itens: [
      ...itens.map((i, idx) => ({ descricao: i.descricao, quantidade: i.quantidade, valor: linhas.itens[idx] })),
      ...(linhas.ajuste !== 0 ? [{ descricao: 'Ajuste', quantidade: 1, valor: linhas.ajuste }] : []),
    ],
    valorTotal: valores.valorTotal,
    expiraEm,
    mensagem,
  });
  if (cliente?.email) await registrarEventoPedido({ pedidoId: linha.id, evento: 'email_enviado', dados: { para: cliente.email, modelo: 'criada' } });

  return { ok: true, pedidoId: linha.id, numero: Number(linha.numero) };
}

/**
 * Cancela uma cobrança avulsa ainda não paga: remove as cobranças no Asaas e
 * marca o pedido `cancelado`. Se algo já foi pago, recusa (estorno é Fase 2).
 */
export async function cancelarCobrancaAvulsa(input: {
  pedidoId: string;
  ator: { id: string | null; papel: 'gestor' | 'admin' | 'sistema' };
  motivo: string;
  /** Gestor: só cancela as próprias cobranças. */
  gestorId?: string;
  avisarCliente?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let consulta = supabaseAdmin.from('pedido').select('id, status, tipo').eq('id', input.pedidoId).eq('tipo', 'avulso');
  if (input.gestorId) consulta = consulta.eq('gestor_id', input.gestorId);
  const { data: pedido } = await consulta.maybeSingle();
  if (!pedido) return { ok: false, error: 'Cobrança não encontrada.' };
  if (pedido.status !== 'aguardando_pagamento') return { ok: false, error: 'Só cobranças aguardando pagamento podem ser canceladas.' };

  const { count: pagos } = await supabaseAdmin
    .from('pagamento')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedido.id)
    .in('status', PAGAMENTO_PAGO);
  if (pagos) return { ok: false, error: 'O cliente acabou de pagar esta cobrança — ela não pode mais ser cancelada.' };

  const remocao = await cancelarCobrancasPendentes(pedido.id);
  if (!remocao.ok) return { ok: false, error: 'Não foi possível cancelar a cobrança no meio de pagamento. Tente novamente em instantes.' };

  const motivo = textoLimpo(input.motivo, 300) || 'Cancelada';
  const { data: cancelado } = await supabaseAdmin
    .from('pedido')
    .update({ status: 'cancelado', cancelado_em: new Date().toISOString(), motivo_cancelamento: motivo })
    .eq('id', pedido.id)
    .eq('status', 'aguardando_pagamento')
    .select('id')
    .maybeSingle();
  if (!cancelado) return { ok: false, error: 'A cobrança mudou de situação. Atualize a página.' };
  await registrarEventoPedido({ pedidoId: pedido.id, evento: 'cancelado', atorId: input.ator.id, atorPapel: input.ator.papel, dados: { motivo } });

  if (input.avisarCliente !== false) {
    const d = await dadosParaEmail(pedido.id);
    const base = d ? baseEmailPedido(d) : null;
    if (d && base && d.avulso && d.cliente?.email) {
      await emailCobrancaAvulsaCancelada({ ...base, avulso: d.avulso, para: d.cliente.email, nome: d.cliente.name });
    }
  }
  return { ok: true };
}

/**
 * Antes de cancelar a reserva: encerra as cobranças avulsas em aberto. Se
 * alguma já foi paga, a reserva não pode ser cancelada pelo fluxo simples.
 */
export async function cancelarAvulsasDaReserva(reservaId: string, motivo: string): Promise<{ ok: true } | { ok: false; error: string; temPaga?: boolean }> {
  const { data } = await supabaseAdmin
    .from('pedido_avulso')
    .select('pedido_id, pedido!inner ( status )')
    .eq('reserva_id', reservaId);
  const linhas = (data ?? []) as unknown as { pedido_id: string; pedido: { status: PedidoStatus } }[];
  if (linhas.some((l) => l.pedido.status === 'pago' || l.pedido.status === 'em_disputa')) {
    return { ok: false, error: 'Há cobrança adicional paga nesta reserva.', temPaga: true };
  }
  for (const l of linhas.filter((x) => x.pedido.status === 'aguardando_pagamento')) {
    const r = await cancelarCobrancaAvulsa({ pedidoId: l.pedido_id, ator: { id: null, papel: 'sistema' }, motivo, avisarCliente: false });
    if (!r.ok) return r;
  }
  return { ok: true };
}

/** Rastreio: o gestor copiou/compartilhou o link (1ª vez grava a data; toda vez gera evento). */
export async function registrarLinkCopiado(pedidoId: string, gestorId: string, canal: 'copiar' | 'whatsapp'): Promise<boolean> {
  const { data: pedido } = await supabaseAdmin
    .from('pedido').select('id').eq('id', pedidoId).eq('tipo', 'avulso').eq('gestor_id', gestorId).maybeSingle();
  if (!pedido) return false;
  await supabaseAdmin.from('pedido_avulso').update({ link_copiado_em: new Date().toISOString() }).eq('pedido_id', pedidoId).is('link_copiado_em', null);
  await registrarEventoPedido({ pedidoId, evento: 'link_copiado', atorId: gestorId, atorPapel: 'gestor', dados: { canal } });
  return true;
}

/** Rastreio: 1ª abertura da página da cobrança pelo cliente. */
export async function registrarVisualizacao(pedidoId: string, clienteId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('pedido_avulso')
    .update({ visualizado_em: new Date().toISOString() })
    .eq('pedido_id', pedidoId)
    .is('visualizado_em', null)
    .select('pedido_id')
    .maybeSingle();
  if (data) await registrarEventoPedido({ pedidoId, evento: 'visualizado', atorId: clienteId, atorPapel: 'cliente' });
}

// ── Leitura ──────────────────────────────────────────────────────────────────

export type ItemCobranca = {
  id: string;
  origem: PedidoItemOrigem;
  tipo: PedidoItemTipo;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

export type CobrancaAvulsa = {
  id: string;
  numero: number;
  status: PedidoStatus;
  criado_em: string;
  expira_em: string | null;
  pago_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  valor_itens: number;
  comissao_percentual: number;
  valor_comissao: number;
  valor_total: number;
  titulo: string;
  mensagem_cliente: string | null;
  formas_permitidas: FormaPagamentoCodigo[];
  parcelas_max: number;
  valor_calculado: number;
  valor_ajuste: number;
  motivo_ajuste: string | null;
  link_copiado_em: string | null;
  visualizado_em: string | null;
  itens: ItemCobranca[];
};

const SELECT_COBRANCA = `pedido_id, titulo, mensagem_cliente, formas_permitidas, parcelas_max, valor_calculado, valor_ajuste,
  motivo_ajuste, link_copiado_em, visualizado_em,
  pedido!inner ( id, numero, status, criado_em, expira_em, pago_em, cancelado_em, motivo_cancelamento,
                 valor_itens, comissao_percentual, valor_comissao, valor_total,
                 pedido_item ( id, ordem, origem, tipo, descricao, quantidade, valor_unitario, valor_total ) )`;

type LinhaCobranca = Omit<CobrancaAvulsa, 'itens' | 'id' | 'numero' | 'status' | 'criado_em' | 'expira_em' | 'pago_em' | 'cancelado_em' | 'motivo_cancelamento' | 'valor_itens' | 'comissao_percentual' | 'valor_comissao' | 'valor_total'> & {
  pedido_id: string;
  pedido: Omit<CobrancaAvulsa, 'titulo' | 'mensagem_cliente' | 'formas_permitidas' | 'parcelas_max' | 'valor_calculado' | 'valor_ajuste' | 'motivo_ajuste' | 'link_copiado_em' | 'visualizado_em' | 'itens'> & {
    pedido_item: (ItemCobranca & { ordem: number })[];
  };
};

function montarCobranca(l: LinhaCobranca): CobrancaAvulsa {
  const { pedido_item, ...p } = l.pedido;
  return {
    ...p,
    titulo: l.titulo,
    mensagem_cliente: l.mensagem_cliente,
    formas_permitidas: l.formas_permitidas,
    parcelas_max: l.parcelas_max,
    valor_calculado: Number(l.valor_calculado),
    valor_ajuste: Number(l.valor_ajuste),
    motivo_ajuste: l.motivo_ajuste,
    link_copiado_em: l.link_copiado_em,
    visualizado_em: l.visualizado_em,
    itens: [...(pedido_item ?? [])].sort((a, b) => a.ordem - b.ordem),
  };
}

/** Cobranças avulsas de uma reserva (mais recentes primeiro). Filtre por cliente/gestor antes de chamar. */
export async function listarCobrancasDaReserva(reservaId: string): Promise<CobrancaAvulsa[]> {
  const { data, error } = await supabaseAdmin
    .from('pedido_avulso')
    .select(SELECT_COBRANCA)
    .eq('reserva_id', reservaId)
    .order('criado_em', { ascending: false });
  if (error) {
    console.error('[pagamentos/avulso] falha ao listar cobranças', reservaId, error.message);
    return [];
  }
  return ((data ?? []) as unknown as LinhaCobranca[]).map(montarCobranca);
}

/** Cobranças avulsas por reserva (listas): `{ reservaId: { abertas, valorAberto, total } }`. */
export async function resumoAvulsasPorReserva(reservaIds: string[]): Promise<Record<string, { abertas: number; valorAberto: number; total: number }>> {
  if (!reservaIds.length) return {};
  const { data } = await supabaseAdmin
    .from('pedido_avulso')
    .select('reserva_id, pedido!inner ( status, valor_total, expira_em )')
    .in('reserva_id', reservaIds);
  const r: Record<string, { abertas: number; valorAberto: number; total: number }> = {};
  for (const l of (data ?? []) as unknown as { reserva_id: string; pedido: { status: PedidoStatus; valor_total: number; expira_em: string | null } }[]) {
    const atual = (r[l.reserva_id] ??= { abertas: 0, valorAberto: 0, total: 0 });
    atual.total++;
    if (l.pedido.status === 'aguardando_pagamento' && (!l.pedido.expira_em || new Date(l.pedido.expira_em) > new Date())) {
      atual.abertas++;
      atual.valorAberto = arredondarCentavos(atual.valorAberto + Number(l.pedido.valor_total));
    }
  }
  return r;
}
