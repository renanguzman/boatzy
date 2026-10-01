import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { formatarData, formatarDataHora } from '@/lib/datas';
import { getFinanceiroConfig } from '@/lib/financeiro/config';
import { multiplicadorDaReserva } from '@/lib/pagamentos/valores';
import type { ReservaModalidadePreco, ReservaTipo } from '@/types/supabase';
import { baseUrl, enviarEmail, esc, montarEmailHtml, type BlocoEmail } from './layout';

/**
 * E-mail ao gestor (dono da embarcação/roteiro) quando chega uma nova
 * solicitação de reserva: o que foi pedido, quem pediu, quando, para quantas
 * pessoas, adicionais e valores, com o link para o detalhe no painel.
 * Disparado por `criarReserva` depois da resposta ao cliente (`after()`).
 */

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MODALIDADE: Record<ReservaModalidadePreco, string> = {
  roteiro: 'Roteiro (diária única)',
  diaria: 'Por diária',
  pessoa: 'Por pessoa',
};

type Localidade = { nome: string; estados: { uf: string } | null } | null;

export type DadosNovaSolicitacao = {
  reservaId: string;
  tipo: ReservaTipo;
  itemNome: string;
  embarcacaoNome: string | null;
  localidade: string | null;
  dataReserva: string; // AAAA-MM-DD
  dataFimReserva: string | null;
  flexibilidade: number | null;
  quantidadePessoas: number;
  quantidadeDiarias: number | null;
  modalidade: ReservaModalidadePreco;
  duracaoHoras: number | null;
  precoBase: number | null;
  totalAdicionais: number;
  taxaServico: number | null;
  descontoValor: number;
  cupomCodigo: string | null;
  totalEstimado: number | null;
  adicionais: { descricao: string; valor: number; tipo: string }[];
  solicitadoEm: string;
  clienteNome: string;
  gestorNome: string;
  /** Prazo do cliente para pagar após o aceite (horas), se a cobrança estiver ligada. */
  horasPrazoPagamento: number | null;
};

/** Monta assunto e HTML (puro — sem I/O). */
export function montarEmailNovaSolicitacao(d: DadosNovaSolicitacao): { assunto: string; html: string } {
  const dataLonga = formatarData(d.dataReserva, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const periodo =
    d.dataFimReserva && d.dataFimReserva !== d.dataReserva
      ? `${formatarData(d.dataReserva)} → ${formatarData(d.dataFimReserva)}${d.quantidadeDiarias ? ` (${d.quantidadeDiarias} diária${d.quantidadeDiarias > 1 ? 's' : ''})` : ''}`
      : dataLonga;

  const detalhes: [string, string][] = [
    ['Tipo', d.tipo === 'embarcacao' ? 'Reserva da embarcação' : 'Roteiro'],
    [d.tipo === 'embarcacao' ? 'Embarcação' : 'Passeio', d.itemNome],
  ];
  if (d.tipo === 'roteiro' && d.embarcacaoNome) detalhes.push(['Embarcação', d.embarcacaoNome]);
  if (d.localidade) detalhes.push(['Local', d.localidade]);
  detalhes.push([d.dataFimReserva && d.dataFimReserva !== d.dataReserva ? 'Período' : 'Data', periodo]);
  if (d.flexibilidade && d.flexibilidade > 0) {
    detalhes.push(['Flexibilidade', `± ${d.flexibilidade} dia${d.flexibilidade > 1 ? 's' : ''}`]);
  }
  detalhes.push(['Pessoas', String(d.quantidadePessoas)]);
  if (d.tipo === 'roteiro') detalhes.push(['Modalidade', MODALIDADE[d.modalidade]]);
  if (d.duracaoHoras != null) detalhes.push(['Duração', `${d.duracaoHoras.toLocaleString('pt-BR')}h`]);
  detalhes.push(['Solicitado por', d.clienteNome]);
  detalhes.push(['Solicitado em', formatarDataHora(d.solicitadoEm)]);

  const blocos: BlocoEmail[] = [{ titulo: 'Solicitação', linhas: detalhes }];

  if (d.adicionais.length > 0) {
    blocos.push({
      titulo: 'Adicionais escolhidos',
      linhas: d.adicionais.map((a) => [`${a.descricao}${a.tipo ? ` (${a.tipo === 'servico' ? 'serviço' : 'produto'})` : ''}`, brl(a.valor)]),
    });
  }

  const multiplicador = multiplicadorDaReserva({
    modalidade_preco: d.modalidade,
    quantidade_diarias: d.quantidadeDiarias,
    quantidade_pessoas: d.quantidadePessoas,
  });
  if (d.precoBase != null) {
    const preco = d.precoBase * multiplicador;
    const rotuloPreco =
      d.modalidade === 'diaria' ? `Diárias (${brl(d.precoBase)} × ${multiplicador})`
        : d.modalidade === 'pessoa' ? `Pessoas (${brl(d.precoBase)} × ${multiplicador})`
          : 'Passeio';
    const valores: [string, string][] = [[rotuloPreco, brl(preco)]];
    if (d.totalAdicionais > 0) valores.push(['Adicionais', brl(d.totalAdicionais)]);
    valores.push(['Seu valor (passeio + adicionais)', brl(preco + d.totalAdicionais)]);
    if (d.taxaServico != null) valores.push(['Taxa de serviço (paga pelo cliente)', brl(d.taxaServico)]);
    if (d.descontoValor > 0) valores.push([`Desconto${d.cupomCodigo ? ` (cupom ${d.cupomCodigo})` : ''}`, `− ${brl(d.descontoValor)}`]);
    if (d.totalEstimado != null) valores.push(['Total estimado do cliente', brl(d.totalEstimado)]);
    blocos.push({ titulo: 'Valores', linhas: valores, destacarUltima: d.totalEstimado != null });
  }

  const paragrafos = [
    `<strong>${esc(d.clienteNome)}</strong> enviou uma solicitação de reserva para <strong>${esc(d.itemNome)}</strong> em <strong>${esc(formatarData(d.dataReserva))}</strong>. Confira os detalhes:`,
  ];
  if (d.precoBase == null) {
    paragrafos.push('Este item está com <strong>preço a combinar</strong>: ao aceitar, você informa o valor do passeio no painel.');
  }
  paragrafos.push(
    d.horasPrazoPagamento != null
      ? `Ao aceitar, o cliente recebe a cobrança e tem até ${d.horasPrazoPagamento}h para pagar pelo Boatzy — a data fica reservada enquanto isso. Se não puder atender, recuse a solicitação para que o cliente seja avisado.`
      : 'Acesse o painel para confirmar ou recusar a solicitação.',
  );

  const html = montarEmailHtml({
    nome: d.gestorNome,
    paragrafos,
    blocos,
    botao: { texto: 'Ver solicitação no painel', url: `${baseUrl()}/painel/agendamentos/${d.reservaId}` },
    aposBotao: 'Para tirar dúvidas, converse com o cliente pelo chat do painel do Boatzy.',
    rodape: `Você recebe este e-mail porque é o gestor de ${d.itemNome} no Boatzy.`,
  });

  return { assunto: `Nova solicitação de reserva — ${d.itemNome} em ${formatarData(d.dataReserva)}`, html };
}

function textoLocalidade(m: Localidade): string | null {
  if (!m) return null;
  return m.estados ? `${m.nome}, ${m.estados.uf}` : m.nome;
}

/**
 * Carrega a reserva e avisa o gestor por e-mail. Nunca lança — falhas são
 * logadas (a solicitação do cliente já foi registrada).
 */
export async function notificarGestorNovaSolicitacao(reservaId: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('reserva')
      .select(
        `id, tipo, owner_id, cliente_id, item_nome, data_reserva, data_fim_reserva, flexibilidade,
         quantidade_pessoas, quantidade_diarias, modalidade_preco, preco_base, total_adicionais,
         taxa_servico, desconto_valor, cupom_codigo, total_estimado, solicitado_em,
         cliente:users!reserva_cliente_id_fkey ( name ),
         roteiro ( nome, duracao_horas, municipios ( nome, estados ( uf ) ) ),
         embarcacao ( nome, municipios ( nome, estados ( uf ) ) ),
         reserva_adicional ( descricao, valor, tipo )`,
      )
      .eq('id', reservaId)
      .maybeSingle();
    const r = data as unknown as {
      id: string;
      tipo: ReservaTipo;
      owner_id: string;
      cliente_id: string;
      item_nome: string;
      data_reserva: string;
      data_fim_reserva: string | null;
      flexibilidade: number | null;
      quantidade_pessoas: number;
      quantidade_diarias: number | null;
      modalidade_preco: ReservaModalidadePreco;
      preco_base: number | null;
      total_adicionais: number;
      taxa_servico: number | null;
      desconto_valor: number;
      cupom_codigo: string | null;
      total_estimado: number | null;
      solicitado_em: string;
      cliente: { name: string } | null;
      roteiro: { nome: string; duracao_horas: number | null; municipios: Localidade } | null;
      embarcacao: { nome: string; municipios: Localidade } | null;
      reserva_adicional: { descricao: string; valor: number; tipo: string }[];
    } | null;
    if (!r) return;
    if (r.owner_id === r.cliente_id) return; // gestor solicitando o próprio item

    const { data: gestor } = await supabaseAdmin.from('users').select('name, email').eq('id', r.owner_id).maybeSingle();
    if (!gestor?.email) return;

    let horasPrazoPagamento: number | null = null;
    try {
      const cfg = await getFinanceiroConfig();
      if (cfg.exigir_pagamento) horasPrazoPagamento = cfg.horas_prazo_pagamento;
    } catch {
      // sem config financeira → texto genérico
    }

    const { assunto, html } = montarEmailNovaSolicitacao({
      reservaId: r.id,
      tipo: r.tipo,
      itemNome: r.roteiro?.nome ?? r.item_nome,
      embarcacaoNome: r.embarcacao?.nome ?? null,
      localidade: textoLocalidade(r.roteiro?.municipios ?? r.embarcacao?.municipios ?? null),
      dataReserva: r.data_reserva,
      dataFimReserva: r.data_fim_reserva,
      flexibilidade: r.flexibilidade,
      quantidadePessoas: r.quantidade_pessoas,
      quantidadeDiarias: r.quantidade_diarias,
      modalidade: r.modalidade_preco,
      duracaoHoras: r.roteiro?.duracao_horas != null ? Number(r.roteiro.duracao_horas) : null,
      precoBase: r.preco_base != null ? Number(r.preco_base) : null,
      totalAdicionais: Number(r.total_adicionais),
      taxaServico: r.taxa_servico != null ? Number(r.taxa_servico) : null,
      descontoValor: Number(r.desconto_valor),
      cupomCodigo: r.cupom_codigo,
      totalEstimado: r.total_estimado != null ? Number(r.total_estimado) : null,
      adicionais: (r.reserva_adicional ?? []).map((a) => ({ descricao: a.descricao, valor: Number(a.valor), tipo: a.tipo })),
      solicitadoEm: r.solicitado_em,
      clienteNome: r.cliente?.name ?? 'Um cliente',
      gestorNome: gestor.name,
      horasPrazoPagamento,
    });

    await enviarEmail(gestor.email, assunto, html, 'nova solicitação de reserva');
  } catch (err) {
    console.error('[emails/reserva-solicitada] falha ao notificar gestor', reservaId, err instanceof Error ? err.message : err);
  }
}
