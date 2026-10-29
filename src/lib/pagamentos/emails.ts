import 'server-only';

import { formatarData, formatarDataHora } from '@/lib/datas';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from '@/lib/emails/layout';
import type { RegistroEmail } from '@/lib/comunicacao/registrar';
import type { ComunicacaoPapel } from '@/types/supabase';

/**
 * E-mails do fluxo de pagamento — layout padrão (`src/lib/emails/layout.ts`).
 * Falha no envio é logada e nunca interrompe o fluxo de pagamento.
 */

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => formatarData(iso);
const dataHoraBR = (iso: string) => formatarDataHora(iso);

function montarHtml(input: {
  nome: string;
  paragrafos: string[]; // HTML já escapado
  linhas: [string, string][]; // rótulo, valor (texto puro)
  botao?: { texto: string; url: string };
  rodape: string;
}): string {
  return montarEmailHtml({ ...input, blocos: [{ linhas: input.linhas }] });
}

const enviar = (to: string | null | undefined, subject: string, html: string, contexto: string, reg?: RegistroEmail) =>
  enviarEmail(to, subject, html, `pagamentos/${contexto}`, reg);

/** Registro na linha do tempo de comunicações da reserva (SPEC §96). */
const registro = (input: { reservaId?: string | null }, papel: ComunicacaoPapel, tipo: string): RegistroEmail | undefined =>
  input.reservaId ? { reservaId: input.reservaId, papel, tipo } : undefined;

export type DadosPedidoEmail = {
  reservaId: string;
  pedidoNumero: number;
  itemNome: string;
  dataReserva: string; // AAAA-MM-DD
  valorTotal: number;
  /** Cobrança avulsa do gestor (SPEC §34.16) — muda textos e links. */
  avulso?: { pedidoId: string; titulo: string } | null;
};

const urlCobranca = (pedidoId: string) => `${baseUrl()}/cobrancas/${pedidoId}`;
/** Rótulo do nº: "Pedido #1001" ou "Cobrança #1002". */
const rotuloNumero = (input: DadosPedidoEmail): [string, string] => [input.avulso ? 'Cobrança' : 'Pedido', `#${input.pedidoNumero}`];
const RODAPE_CLIENTE_AVULSO = 'Você recebe este e-mail porque fez uma reserva no Boatzy.';

/** Cliente: o gestor aceitou — pague até o prazo. */
export async function emailPagamentoPendente(input: DadosPedidoEmail & { para: string; nome: string; expiraEm: string }) {
  if (input.avulso) {
    await enviar(
      input.para,
      `Cobrança do seu passeio — pague até ${dataHoraBR(input.expiraEm)}`,
      montarHtml({
        nome: input.nome,
        paragrafos: [
          `Há uma cobrança em aberto referente a <strong>${esc(input.itemNome)}</strong>: <strong>${esc(input.avulso.titulo)}</strong>. Pague pelo Boatzy até <strong>${esc(dataHoraBR(input.expiraEm))}</strong>.`,
        ],
        linhas: [
          rotuloNumero(input),
          ['Data do passeio', dataBR(input.dataReserva)],
          ['Total', brl(input.valorTotal)],
        ],
        botao: { texto: 'Pagar agora', url: urlCobranca(input.avulso.pedidoId) },
        rodape: RODAPE_CLIENTE_AVULSO,
      }),
      'cobranca avulsa pendente',
      registro(input, 'cliente', 'cobranca_avulsa'),
    );
    return;
  }
  const url = `${baseUrl()}/reservas/${input.reservaId}/pagar`;
  await enviar(
    input.para,
    `Sua reserva foi aceita — pague até ${dataHoraBR(input.expiraEm)}`,
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `O gestor aceitou sua solicitação de <strong>${esc(input.itemNome)}</strong>. Para garantir a data, conclua o pagamento pelo Boatzy até <strong>${esc(dataHoraBR(input.expiraEm))}</strong>.`,
        'Depois desse prazo a solicitação expira e a data volta a ficar disponível para outras pessoas.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Total', brl(input.valorTotal)],
      ],
      botao: { texto: 'Pagar agora', url },
      rodape: 'Você recebe este e-mail porque solicitou uma reserva no Boatzy.',
    }),
    'pagamento pendente',
    registro(input, 'cliente', 'aguardando_pagamento'),
  );
}

/** Cliente: pagamento confirmado → reserva confirmada. */
export async function emailPagamentoConfirmado(input: DadosPedidoEmail & { para: string; nome: string }) {
  if (input.avulso) {
    await enviar(
      input.para,
      `Pagamento confirmado — ${input.avulso.titulo}`,
      montarHtml({
        nome: input.nome,
        paragrafos: [
          `Recebemos o pagamento de <strong>${esc(input.avulso.titulo)}</strong>, referente a <strong>${esc(input.itemNome)}</strong>. Obrigado!`,
        ],
        linhas: [
          rotuloNumero(input),
          ['Data do passeio', dataBR(input.dataReserva)],
          ['Total pago', brl(input.valorTotal)],
        ],
        botao: { texto: 'Ver comprovante', url: urlCobranca(input.avulso.pedidoId) },
        rodape: RODAPE_CLIENTE_AVULSO,
      }),
      'cobranca avulsa paga',
      registro(input, 'cliente', 'pagamento_aprovado'),
    );
    return;
  }
  await enviar(
    input.para,
    'Pagamento confirmado — sua reserva está garantida',
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `Recebemos o pagamento de <strong>${esc(input.itemNome)}</strong>. Sua reserva está <strong>confirmada</strong>.`,
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Total pago', brl(input.valorTotal)],
      ],
      botao: { texto: 'Ver comprovante', url: `${baseUrl()}/minhas-reservas/${input.reservaId}#comprovante` },
      rodape: 'Você recebe este e-mail porque fez uma reserva no Boatzy.',
    }),
    'pagamento confirmado',
    registro(input, 'cliente', 'pagamento_aprovado'),
  );
}

/** Gestor: o cliente pagou — reserva confirmada. */
export async function emailReservaPaga(input: DadosPedidoEmail & { para: string; nome: string; clienteNome: string; valorItens: number }) {
  if (input.avulso) {
    await enviar(
      input.para,
      `Cobrança paga — ${input.avulso.titulo}`,
      montarHtml({
        nome: input.nome,
        paragrafos: [
          `<strong>${esc(input.clienteNome)}</strong> pagou a cobrança <strong>${esc(input.avulso.titulo)}</strong>, referente a <strong>${esc(input.itemNome)}</strong>.`,
          'O repasse segue as mesmas regras do pagamento da reserva.',
        ],
        linhas: [
          rotuloNumero(input),
          ['Data do passeio', dataBR(input.dataReserva)],
          ['Seu valor', brl(input.valorItens)],
        ],
        botao: botaoPainel(input.reservaId),
        rodape: RODAPE_GESTOR,
      }),
      'gestor cobranca avulsa paga',
      registro(input, 'gestor', 'pagamento_aprovado'),
    );
    return;
  }
  await enviar(
    input.para,
    `Reserva paga — ${input.itemNome} em ${dataBR(input.dataReserva)}`,
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `<strong>${esc(input.clienteNome)}</strong> concluiu o pagamento. A reserva de <strong>${esc(input.itemNome)}</strong> está <strong>confirmada</strong>.`,
        'O repasse do seu valor é feito após o passeio, depois que você confirmar no painel que ele foi realizado.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Seu valor', brl(input.valorItens)],
      ],
      botao: { texto: 'Ver no painel', url: `${baseUrl()}/painel/agendamentos/${input.reservaId}` },
      rodape: 'Você recebe este e-mail porque é gestor no Boatzy.',
    }),
    'reserva paga',
    registro(input, 'gestor', 'pagamento_aprovado'),
  );
}

/** Cliente: o prazo de pagamento acabou. */
export async function emailPedidoExpirado(input: DadosPedidoEmail & { para: string; nome: string }) {
  if (input.avulso) {
    await enviar(
      input.para,
      `Cobrança encerrada — ${input.avulso.titulo}`,
      montarHtml({
        nome: input.nome,
        paragrafos: [
          `O prazo para pagar <strong>${esc(input.avulso.titulo)}</strong> (referente a <strong>${esc(input.itemNome)}</strong>) terminou, e a cobrança foi encerrada. Nenhum valor foi cobrado.`,
          'Se tiver dúvidas, fale com o gestor pela conversa da reserva.',
        ],
        linhas: [rotuloNumero(input), ['Data do passeio', dataBR(input.dataReserva)]],
        botao: { texto: 'Ver minha reserva', url: `${baseUrl()}/minhas-reservas/${input.reservaId}` },
        rodape: RODAPE_CLIENTE_AVULSO,
      }),
      'cobranca avulsa expirada',
      registro(input, 'cliente', 'cobranca_avulsa'),
    );
    return;
  }
  await enviar(
    input.para,
    'O prazo de pagamento da sua reserva expirou',
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `O prazo para pagar <strong>${esc(input.itemNome)}</strong> terminou sem pagamento, e a solicitação expirou. Nenhum valor foi cobrado.`,
        'Se ainda quiser o passeio, faça uma nova solicitação — a data pode continuar disponível.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
      ],
      botao: { texto: 'Buscar passeios', url: `${baseUrl()}/buscar` },
      rodape: 'Você recebe este e-mail porque solicitou uma reserva no Boatzy.',
    }),
    'pedido expirado',
    registro(input, 'cliente', 'reserva_expirada'),
  );
}

/** Cliente: cartão negado / reprovado na análise — ainda dá para pagar até o prazo. */
export async function emailPagamentoRecusado(input: DadosPedidoEmail & { para: string; nome: string; expiraEm: string | null }) {
  if (input.avulso) {
    await enviar(
      input.para,
      'Seu pagamento não foi aprovado — tente novamente',
      montarHtml({
        nome: input.nome,
        paragrafos: [
          `O pagamento de <strong>${esc(input.avulso.titulo)}</strong> não foi aprovado pela operadora. Nenhum valor foi cobrado.`,
          input.expiraEm
            ? `Você ainda pode pagar até <strong>${esc(dataHoraBR(input.expiraEm))}</strong>, com outro cartão ou por Pix (se liberado).`
            : 'Tente novamente com outro cartão ou por Pix (se liberado).',
        ],
        linhas: [rotuloNumero(input), ['Total', brl(input.valorTotal)]],
        botao: { texto: 'Tentar novamente', url: urlCobranca(input.avulso.pedidoId) },
        rodape: RODAPE_CLIENTE_AVULSO,
      }),
      'cobranca avulsa recusada',
      registro(input, 'cliente', 'pagamento_recusado'),
    );
    return;
  }
  await enviar(
    input.para,
    'Seu pagamento não foi aprovado — tente novamente',
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `O pagamento de <strong>${esc(input.itemNome)}</strong> não foi aprovado pela operadora. Nenhum valor foi cobrado.`,
        input.expiraEm
          ? `Sua data continua reservada até <strong>${esc(dataHoraBR(input.expiraEm))}</strong>: tente com outro cartão ou pague por Pix.`
          : 'Tente com outro cartão ou pague por Pix.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Total', brl(input.valorTotal)],
      ],
      botao: { texto: 'Tentar novamente', url: `${baseUrl()}/reservas/${input.reservaId}/pagar` },
      rodape: 'Você recebe este e-mail porque solicitou uma reserva no Boatzy.',
    }),
    'pagamento recusado',
    registro(input, 'cliente', 'pagamento_recusado'),
  );
}

/** Cliente: estorno total ou parcial do pedido. */
export async function emailReembolso(input: DadosPedidoEmail & { para: string; nome: string; parcial: boolean }) {
  await enviar(
    input.para,
    input.parcial ? 'Reembolso parcial realizado' : 'Reembolso realizado',
    montarHtml({
      nome: input.nome,
      paragrafos: [
        input.avulso
          ? `${input.parcial ? 'Parte do valor' : 'O valor'} da cobrança <strong>${esc(input.avulso.titulo)}</strong> foi estornado.`
          : `${input.parcial ? 'Parte do valor' : 'O valor'} do pedido de <strong>${esc(input.itemNome)}</strong> foi estornado.`,
        'O prazo para o valor aparecer no extrato depende do seu banco ou da operadora do cartão.',
      ],
      linhas: [
        rotuloNumero(input),
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Total do pedido', brl(input.valorTotal)],
      ],
      botao: input.avulso
        ? { texto: 'Ver cobrança', url: urlCobranca(input.avulso.pedidoId) }
        : { texto: 'Ver minha reserva', url: `${baseUrl()}/minhas-reservas/${input.reservaId}#comprovante` },
      rodape: 'Você recebe este e-mail porque fez uma reserva no Boatzy.',
    }),
    'reembolso',
    registro(input, 'cliente', 'reembolso'),
  );
}

/* ── Gestor: status de pagamento que dependem do cliente (SPEC §87) ── */

type DadosGestorEmail = DadosPedidoEmail & { para: string; nome: string; clienteNome: string };

const botaoPainel = (reservaId: string) => ({ texto: 'Ver no painel', url: `${baseUrl()}/painel/agendamentos/${reservaId}` });
const RODAPE_GESTOR = 'Você recebe este e-mail porque é gestor no Boatzy.';

/** Gestor: o cliente não pagou dentro do prazo — a data voltou a ficar livre. */
export async function emailGestorPedidoExpirado(input: DadosGestorEmail) {
  if (input.avulso) {
    await enviar(
      input.para,
      `Cobrança não paga no prazo — ${input.avulso.titulo}`,
      montarHtml({
        nome: input.nome,
        paragrafos: [
          `<strong>${esc(input.clienteNome)}</strong> não pagou a cobrança <strong>${esc(input.avulso.titulo)}</strong> (referente a <strong>${esc(input.itemNome)}</strong>) dentro do prazo, e ela foi encerrada.`,
          'Se ainda quiser cobrar, emita uma nova cobrança no detalhe da reserva.',
        ],
        linhas: [rotuloNumero(input), ['Data do passeio', dataBR(input.dataReserva)]],
        botao: botaoPainel(input.reservaId),
        rodape: RODAPE_GESTOR,
      }),
      'gestor cobranca avulsa expirada',
      registro(input, 'gestor', 'cobranca_avulsa'),
    );
    return;
  }
  await enviar(
    input.para,
    `Pagamento não feito no prazo — ${input.itemNome} em ${dataBR(input.dataReserva)}`,
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `<strong>${esc(input.clienteNome)}</strong> não pagou <strong>${esc(input.itemNome)}</strong> dentro do prazo, e a solicitação expirou.`,
        'A data voltou a ficar disponível para outras reservas. Nenhum valor foi cobrado do cliente.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
      ],
      botao: botaoPainel(input.reservaId),
      rodape: RODAPE_GESTOR,
    }),
    'gestor pedido expirado',
    registro(input, 'gestor', 'reserva_expirada'),
  );
}

/** Gestor: o pagamento do cliente foi recusado — ele ainda pode pagar até o prazo. */
export async function emailGestorPagamentoRecusado(input: DadosGestorEmail & { expiraEm: string | null }) {
  await enviar(
    input.para,
    `Pagamento do cliente recusado — ${input.itemNome} em ${dataBR(input.dataReserva)}`,
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `O pagamento de <strong>${esc(input.clienteNome)}</strong> para <strong>${esc(input.avulso?.titulo ?? input.itemNome)}</strong> não foi aprovado pela operadora.`,
        input.avulso
          ? (input.expiraEm ? `O cliente ainda pode pagar até <strong>${esc(dataHoraBR(input.expiraEm))}</strong>.` : 'O cliente ainda pode tentar novamente.')
          : input.expiraEm
          ? `A data continua segurada até <strong>${esc(dataHoraBR(input.expiraEm))}</strong>: o cliente pode tentar com outro cartão ou pagar por Pix. Se não pagar, a solicitação expira sozinha.`
          : 'O cliente pode tentar com outro cartão ou pagar por Pix.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Total', brl(input.valorTotal)],
      ],
      botao: botaoPainel(input.reservaId),
      rodape: RODAPE_GESTOR,
    }),
    'gestor pagamento recusado',
    registro(input, 'gestor', 'pagamento_recusado'),
  );
}

/** Gestor: o pedido do cliente foi estornado (total ou parcial). */
export async function emailGestorReembolso(input: DadosGestorEmail & { parcial: boolean }) {
  await enviar(
    input.para,
    `${input.parcial ? 'Reembolso parcial' : 'Reembolso'} ao cliente — ${input.itemNome} em ${dataBR(input.dataReserva)}`,
    montarHtml({
      nome: input.nome,
      paragrafos: [
        input.avulso
          ? `${input.parcial ? 'Parte do valor' : 'O valor'} da cobrança <strong>${esc(input.avulso.titulo)}</strong> de <strong>${esc(input.clienteNome)}</strong> foi estornado ao cliente.`
          : `${input.parcial ? 'Parte do valor' : 'O valor'} do pedido de <strong>${esc(input.clienteNome)}</strong> para <strong>${esc(input.itemNome)}</strong> foi estornado ao cliente.`,
        'Se tiver dúvidas sobre o reembolso ou o repasse, fale com o suporte do Boatzy.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Total do pedido', brl(input.valorTotal)],
      ],
      botao: botaoPainel(input.reservaId),
      rodape: RODAPE_GESTOR,
    }),
    'gestor reembolso',
    registro(input, 'gestor', 'reembolso'),
  );
}

/* ── Cobrança avulsa (SPEC §34.16) ── */

/** Cliente: o gestor emitiu uma cobrança avulsa — itens já com a taxa embutida. */
export async function emailCobrancaAvulsaCriada(input: {
  /** Reserva de origem — registra o envio na linha do tempo da reserva. */
  reservaId?: string | null;
  para: string;
  nome: string;
  gestorNome: string;
  pedidoId: string;
  pedidoNumero: number;
  titulo: string;
  itemNome: string;
  dataReserva: string;
  itens: { descricao: string; quantidade: number; valor: number }[];
  valorTotal: number;
  expiraEm: string;
  mensagem: string | null;
}) {
  const qtd = (n: number) => (n === 1 ? '' : `${n.toLocaleString('pt-BR')} × `);
  await enviar(
    input.para,
    `Nova cobrança: ${input.titulo} — pague até ${dataHoraBR(input.expiraEm)}`,
    montarEmailHtml({
      nome: input.nome,
      paragrafos: [
        `<strong>${esc(input.gestorNome)}</strong> enviou uma cobrança referente ao seu passeio <strong>${esc(input.itemNome)}</strong> (${esc(dataBR(input.dataReserva))}): <strong>${esc(input.titulo)}</strong>.`,
        ...(input.mensagem ? [`Recado do gestor: “${esc(input.mensagem)}”`] : []),
        `Pague pelo Boatzy até <strong>${esc(dataHoraBR(input.expiraEm))}</strong>.`,
      ],
      blocos: [
        { titulo: 'Itens', linhas: input.itens.map((i): [string, string] => [`${qtd(i.quantidade)}${i.descricao}`, brl(i.valor)]) },
        { linhas: [['Cobrança', `#${input.pedidoNumero}`], ['Total', brl(input.valorTotal)]], destacarUltima: true },
      ],
      botao: { texto: 'Pagar agora', url: urlCobranca(input.pedidoId) },
      rodape: RODAPE_CLIENTE_AVULSO,
    }),
    'cobranca avulsa criada',
    registro(input, 'cliente', 'cobranca_avulsa'),
  );
}

/** Cliente: o gestor cancelou a cobrança avulsa. */
export async function emailCobrancaAvulsaCancelada(input: DadosPedidoEmail & { para: string; nome: string; avulso: { pedidoId: string; titulo: string } }) {
  await enviar(
    input.para,
    `Cobrança cancelada — ${input.avulso.titulo}`,
    montarHtml({
      nome: input.nome,
      paragrafos: [
        `A cobrança <strong>${esc(input.avulso.titulo)}</strong>, referente a <strong>${esc(input.itemNome)}</strong>, foi cancelada pelo gestor. Nenhum valor foi cobrado.`,
      ],
      linhas: [rotuloNumero(input), ['Data do passeio', dataBR(input.dataReserva)]],
      botao: { texto: 'Ver minha reserva', url: `${baseUrl()}/minhas-reservas/${input.reservaId}` },
      rodape: RODAPE_CLIENTE_AVULSO,
    }),
    'cobranca avulsa cancelada',
    registro(input, 'cliente', 'cobranca_avulsa'),
  );
}
