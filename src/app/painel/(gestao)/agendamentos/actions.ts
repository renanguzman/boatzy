'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { getDatasReservadasEmbarcacao, haConflitoReservaRoteiro } from '@/lib/reservas';
import { getAtendenteOptions, resolveEmbarcacaoIdDaReserva } from '@/lib/equipe';
import { getTaxaEfetiva } from '@/lib/taxas';
import { getFinanceiroConfig } from '@/lib/financeiro/config';
import { calcularExpiracao } from '@/lib/pagamentos/pedidos';
import { emailPagamentoPendente } from '@/lib/pagamentos/emails';
import { calcularValoresPedido, multiplicadorDaReserva, VALOR_MINIMO_COBRANCA } from '@/lib/pagamentos/valores';
import type { ReservaModalidadePreco } from '@/types/supabase';

type ActionResult = { ok: boolean; error?: string };

const CONFLITO_MSG =
  'Não é possível confirmar: já existe outra reserva confirmada (ou aguardando pagamento) para esta data.';

/** Converte o valor digitado ("1.234,56" ou "1234.56") em número; null se inválido. */
function paraNumero(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const limpo = v.trim().replace(/\s/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

type ReservaParaChecagem = {
  tipo: 'roteiro' | 'embarcacao';
  roteiro_id: string | null;
  embarcacao_id: string | null;
  data_reserva: string;
  data_fim_reserva: string | null;
  modalidade_preco: 'roteiro' | 'diaria' | 'pessoa';
  quantidade_pessoas: number;
  roteiro: {
    embarcacao_id: string | null;
    preco_pessoa_modo_capacidade: 'compartilhado' | 'exclusivo';
    preco_pessoa_capacidade_maxima: number | null;
  } | null;
};

/**
 * Regrava os atendentes (equipe / próprio gestor) de uma reserva, validando
 * que cada id é uma opção legítima para a embarcação da reserva.
 */
async function definirAtendentesInterno(
  ownerId: string,
  reserva: ReservaParaChecagem & { id: string },
  atendenteIds: string[],
): Promise<ActionResult> {
  const embarcacaoId = resolveEmbarcacaoIdDaReserva(reserva);
  const opcoes = await getAtendenteOptions(ownerId, embarcacaoId);
  const permitidos = new Set(opcoes.map((o) => o.id));

  const ids = [...new Set(atendenteIds)].filter((id) => permitidos.has(id));

  if (ids.length === 0) {
    return { ok: false, error: 'Selecione ao menos uma pessoa para atender a reserva.' };
  }

  await supabaseAdmin.from('reserva_atendente').delete().eq('reserva_id', reserva.id);

  const { error } = await supabaseAdmin
    .from('reserva_atendente')
    .insert(ids.map((equipe_membro_id) => ({ reserva_id: reserva.id, equipe_membro_id })));

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

type ReservaParaPedido = {
  id: string;
  status: string;
  cliente_id: string;
  item_nome: string;
  data_reserva: string;
  modalidade_preco: ReservaModalidadePreco;
  quantidade_diarias: number | null;
  quantidade_pessoas: number;
  preco_base: number | null;
  total_adicionais: number;
  taxa_percent: number | null;
  taxa_servico: number | null;
  desconto_valor: number;
  total_estimado: number | null;
  cupom_id: string | null;
  cupom_codigo: string | null;
  observacao_gestor: string | null;
};

/**
 * Aceite com pagamento: calcula os valores (com o preço informado pelo gestor
 * se era "a combinar"), coloca a reserva em `aguardando_pagamento` (segura a
 * data), gera o pedido (+ desconto do cupom) e avisa o cliente. A comissão usa
 * a taxa congelada na SOLICITAÇÃO (`reserva.taxa_percent`, decisão D7); o
 * cupom fica limitado à comissão. Se o pedido falhar, a reserva volta ao que era.
 */
async function aceitarComPagamento(params: {
  reservaId: string;
  ownerId: string;
  observacao?: string;
  precoUnitario?: string;
  horasPrazo: number;
}): Promise<ActionResult> {
  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `id, status, cliente_id, item_nome, data_reserva, modalidade_preco, quantidade_diarias, quantidade_pessoas,
       preco_base, total_adicionais, taxa_percent, taxa_servico, desconto_valor, total_estimado,
       cupom_id, cupom_codigo, observacao_gestor`,
    )
    .eq('id', params.reservaId)
    .eq('owner_id', params.ownerId)
    .single();
  const r = data as unknown as ReservaParaPedido | null;
  if (!r) return { ok: false, error: 'Reserva não encontrada ou sem permissão.' };
  if (r.status !== 'pendente') return { ok: false, error: 'Esta reserva não está mais pendente.' };

  const precoUnitario = r.preco_base != null ? Number(r.preco_base) : paraNumero(params.precoUnitario);
  if (precoUnitario == null || precoUnitario <= 0) {
    return { ok: false, error: 'Informe o valor do passeio para enviar a cobrança ao cliente.' };
  }

  // Reservas anteriores a 30/09/2026 com preço "a combinar" não guardavam a taxa.
  const taxaPercent = r.taxa_percent != null ? Number(r.taxa_percent) : await getTaxaEfetiva(params.ownerId);
  const valores = calcularValoresPedido({
    precoUnitario,
    multiplicador: multiplicadorDaReserva(r),
    totalAdicionais: Number(r.total_adicionais),
    taxaPercent,
    descontoCupom: Number(r.desconto_valor),
  });
  if (valores.valorTotal < VALOR_MINIMO_COBRANCA) {
    return { ok: false, error: `O total precisa ser de pelo menos R$ ${VALOR_MINIMO_COBRANCA},00 para pagamento online.` };
  }

  const agora = new Date();
  const expiraEm = calcularExpiracao(agora, params.horasPrazo, r.data_reserva);
  if (expiraEm <= agora) return { ok: false, error: 'A data desta reserva já passou.' };

  const observacao = params.observacao?.trim() ? params.observacao.trim() : null;

  // 1) Reserva → aguardando_pagamento (o índice único parcial segura a data).
  const { data: aceita, error: erroReserva } = await supabaseAdmin
    .from('reserva')
    .update({
      status: 'aguardando_pagamento',
      pagamento_exigido: true,
      aceita_em: agora.toISOString(),
      respondido_em: agora.toISOString(),
      observacao_gestor: observacao,
      preco_base: precoUnitario,
      taxa_percent: taxaPercent,
      taxa_servico: valores.valorComissao,
      desconto_valor: valores.valorDesconto,
      total_estimado: valores.valorTotal,
    })
    .eq('id', r.id)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle();
  if (erroReserva) {
    if (erroReserva.code === '23505') return { ok: false, error: CONFLITO_MSG };
    return { ok: false, error: erroReserva.message };
  }
  if (!aceita) return { ok: false, error: 'Esta reserva não está mais pendente.' };

  // 2) Pedido (+ desconto do cupom).
  const { data: pedido, error: erroPedido } = await supabaseAdmin
    .from('pedido')
    .insert({
      reserva_id: r.id,
      cliente_id: r.cliente_id,
      gestor_id: params.ownerId,
      valor_itens: valores.valorItens,
      comissao_percentual: taxaPercent,
      valor_comissao: valores.valorComissao,
      valor_desconto: valores.valorDesconto,
      valor_total: valores.valorTotal,
      expira_em: expiraEm.toISOString(),
    })
    .select('id, numero')
    .single();

  if (!erroPedido && pedido && r.cupom_id && valores.valorDesconto > 0) {
    const { error: erroDesconto } = await supabaseAdmin.from('pedido_desconto').insert({
      pedido_id: pedido.id,
      tipo: 'cupom',
      cupom_id: r.cupom_id,
      cupom_codigo: r.cupom_codigo ?? '',
      descricao: 'Cupom aplicado na solicitação',
      valor: valores.valorDesconto,
    });
    if (erroDesconto) console.error('[agendamentos] falha ao registrar desconto do pedido', pedido.id, erroDesconto.message);
  }

  if (erroPedido || !pedido) {
    console.error('[agendamentos] falha ao gerar pedido — revertendo aceite', r.id, erroPedido?.message);
    await supabaseAdmin
      .from('reserva')
      .update({
        status: 'pendente',
        pagamento_exigido: false,
        aceita_em: null,
        respondido_em: null,
        observacao_gestor: r.observacao_gestor,
        preco_base: r.preco_base,
        taxa_percent: r.taxa_percent,
        taxa_servico: r.taxa_servico,
        desconto_valor: r.desconto_valor,
        total_estimado: r.total_estimado,
      })
      .eq('id', r.id);
    return { ok: false, error: 'Não foi possível gerar o pedido. Tente novamente.' };
  }

  // 3) Avisa o cliente (falha no e-mail não desfaz o aceite).
  const { data: cliente } = await supabaseAdmin.from('users').select('name, email').eq('id', r.cliente_id).single();
  await emailPagamentoPendente({
    para: cliente?.email ?? '',
    nome: cliente?.name ?? '',
    reservaId: r.id,
    pedidoNumero: pedido.numero,
    itemNome: r.item_nome,
    dataReserva: r.data_reserva,
    valorTotal: valores.valorTotal,
    expiraEm: expiraEm.toISOString(),
  });

  revalidatePath('/painel/agendamentos');
  revalidatePath(`/painel/agendamentos/${r.id}`);
  revalidatePath('/minhas-reservas');
  return { ok: true };
}

async function responderReserva(
  reservaId: string,
  status: 'confirmada' | 'recusada',
  observacao?: string,
  atendenteIds?: string[],
  precoUnitario?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  // Garante posse: a reserva deve pertencer a um roteiro/embarcação do gestor.
  // roteiro ( embarcacao_id ) traz o vínculo ATUAL do roteiro — não usar
  // reserva.embarcacao_id isoladamente aqui, pois ele é um snapshot do
  // momento da solicitação e pode estar desatualizado se o gestor trocou a
  // embarcação vinculada do roteiro depois (EditarRoteiroForm permite).
  const { data: reserva } = await supabaseAdmin
    .from('reserva')
    .select(`
      id, owner_id, status, tipo, roteiro_id, embarcacao_id, data_reserva,
      data_fim_reserva, modalidade_preco, quantidade_pessoas,
      roteiro ( embarcacao_id, preco_pessoa_modo_capacidade, preco_pessoa_capacidade_maxima )
    `)
    .eq('id', reservaId)
    .eq('owner_id', user.id)
    .single();

  if (!reserva) return { ok: false, error: 'Reserva não encontrada ou sem permissão.' };

  const r = reserva as unknown as ReservaParaChecagem & { id: string };

  // Ao CONFIRMAR: a embarcação (ou o roteiro, sempre) não pode já ter outra
  // reserva confirmada na mesma data (ou intervalo, no modelo Por Diária) —
  // a própria reserva ainda está pendente neste momento, então nunca conta
  // contra si mesma. No modelo Por Pessoa compartilhado, só há conflito se
  // ultrapassar a capacidade máxima do roteiro.
  if (status === 'confirmada') {
    const haConflito =
      r.tipo === 'embarcacao'
        ? (await getDatasReservadasEmbarcacao(r.embarcacao_id!)).includes(r.data_reserva)
        : await haConflitoReservaRoteiro({
            roteiroId: r.roteiro_id!,
            embarcacaoId: r.roteiro?.embarcacao_id ?? null,
            pessoaModoCapacidade: r.roteiro?.preco_pessoa_modo_capacidade ?? 'exclusivo',
            pessoaCapacidadeMaxima: r.roteiro?.preco_pessoa_capacidade_maxima ?? null,
            modalidadePreco: r.modalidade_preco,
            dataReserva: r.data_reserva,
            dataFimReserva: r.data_fim_reserva,
            quantidadePessoas: r.quantidade_pessoas,
          });
    if (haConflito) {
      return { ok: false, error: CONFLITO_MSG };
    }

    // Atendentes são obrigatórios na confirmação.
    const resAtendentes = await definirAtendentesInterno(user.id, r, atendenteIds ?? []);
    if (!resAtendentes.ok) return resAtendentes;
  }

  // Com a cobrança ligada (Admin → Financeiro → Configurações), o aceite gera o
  // pedido e a reserva fica aguardando o pagamento do cliente (SPEC §34.11).
  if (status === 'confirmada') {
    let exigirPagamento = false;
    let horasPrazo = 24;
    try {
      const cfg = await getFinanceiroConfig();
      exigirPagamento = cfg.exigir_pagamento;
      horasPrazo = cfg.horas_prazo_pagamento;
    } catch (err) {
      console.error('[agendamentos] financeiro_config indisponível — aceite sem cobrança', err);
    }
    if (exigirPagamento) {
      return aceitarComPagamento({ reservaId, ownerId: user.id, observacao, precoUnitario, horasPrazo });
    }
  }

  const { data: respondida, error } = await supabaseAdmin
    .from('reserva')
    .update({
      status,
      observacao_gestor: observacao?.trim() ? observacao.trim() : null,
      respondido_em: new Date().toISOString(),
    })
    .eq('id', reservaId)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle();

  if (!error && !respondida) return { ok: false, error: 'Esta reserva não está mais pendente.' };

  if (error) {
    // 23505 = corrida com outra confirmação simultânea (índices únicos
    // parciais reserva_embarcacao_data_confirmada_uniq /
    // reserva_roteiro_data_confirmada_uniq — rede de segurança contra race
    // condition; a checagem acima já cobre o caso não concorrente).
    if (error.code === '23505') return { ok: false, error: CONFLITO_MSG };
    return { ok: false, error: error.message };
  }

  revalidatePath('/painel/agendamentos');
  revalidatePath(`/painel/agendamentos/${reservaId}`);
  return { ok: true };
}

/**
 * Aceite do gestor. Com a cobrança ligada, gera o pedido e a reserva fica
 * aguardando o pagamento do cliente; `precoUnitario` é obrigatório quando o
 * preço da reserva é "a combinar" (valor por diária/pessoa/roteiro, conforme a
 * modalidade). Com a cobrança desligada, confirma direto (fluxo anterior).
 */
export async function confirmarReserva(
  reservaId: string,
  observacao?: string,
  atendenteIds?: string[],
  precoUnitario?: string,
): Promise<ActionResult> {
  return responderReserva(reservaId, 'confirmada', observacao, atendenteIds, precoUnitario);
}

export async function recusarReserva(reservaId: string, observacao?: string): Promise<ActionResult> {
  return responderReserva(reservaId, 'recusada', observacao);
}

/**
 * Ajusta os atendentes de uma reserva JÁ confirmada (ou concluída), sem
 * alterar o status. Usado na tela de detalhe do agendamento.
 */
export async function definirAtendentes(
  reservaId: string,
  atendenteIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  const { data: reserva } = await supabaseAdmin
    .from('reserva')
    .select('id, owner_id, status, tipo, roteiro_id, embarcacao_id, data_reserva, roteiro ( embarcacao_id )')
    .eq('id', reservaId)
    .eq('owner_id', user.id)
    .single();

  if (!reserva) return { ok: false, error: 'Reserva não encontrada ou sem permissão.' };

  const r = reserva as unknown as ReservaParaChecagem & { id: string; status: string };
  if (r.status !== 'confirmada' && r.status !== 'concluida' && r.status !== 'aguardando_pagamento') {
    return { ok: false, error: 'Só é possível definir atendentes de uma reserva aceita.' };
  }

  const res = await definirAtendentesInterno(user.id, r, atendenteIds);
  if (!res.ok) return res;

  revalidatePath('/painel/agendamentos');
  revalidatePath(`/painel/agendamentos/${reservaId}`);
  return { ok: true };
}
