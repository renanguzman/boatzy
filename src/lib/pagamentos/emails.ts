import 'server-only';

import { formatarData, formatarDataHora } from '@/lib/datas';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from '@/lib/emails/layout';

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

const enviar = (to: string | null | undefined, subject: string, html: string, contexto: string) =>
  enviarEmail(to, subject, html, `pagamentos/${contexto}`);

type DadosPedidoEmail = {
  reservaId: string;
  pedidoNumero: number;
  itemNome: string;
  dataReserva: string; // AAAA-MM-DD
  valorTotal: number;
};

/** Cliente: o gestor aceitou — pague até o prazo. */
export async function emailPagamentoPendente(input: DadosPedidoEmail & { para: string; nome: string; expiraEm: string }) {
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
  );
}

/** Cliente: pagamento confirmado → reserva confirmada. */
export async function emailPagamentoConfirmado(input: DadosPedidoEmail & { para: string; nome: string }) {
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
      botao: { texto: 'Ver minhas reservas', url: `${baseUrl()}/minhas-reservas` },
      rodape: 'Você recebe este e-mail porque fez uma reserva no Boatzy.',
    }),
    'pagamento confirmado',
  );
}

/** Gestor: o cliente pagou — reserva confirmada. */
export async function emailReservaPaga(input: DadosPedidoEmail & { para: string; nome: string; clienteNome: string; valorItens: number }) {
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
  );
}

/** Cliente: o prazo de pagamento acabou. */
export async function emailPedidoExpirado(input: DadosPedidoEmail & { para: string; nome: string }) {
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
  );
}

/** Cliente: cartão negado / reprovado na análise — ainda dá para pagar até o prazo. */
export async function emailPagamentoRecusado(input: DadosPedidoEmail & { para: string; nome: string; expiraEm: string | null }) {
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
        `${input.parcial ? 'Parte do valor' : 'O valor'} do pedido de <strong>${esc(input.itemNome)}</strong> foi estornado.`,
        'O prazo para o valor aparecer no extrato depende do seu banco ou da operadora do cartão.',
      ],
      linhas: [
        ['Pedido', `#${input.pedidoNumero}`],
        ['Data do passeio', dataBR(input.dataReserva)],
        ['Total do pedido', brl(input.valorTotal)],
      ],
      botao: { texto: 'Ver minhas reservas', url: `${baseUrl()}/minhas-reservas#reserva-${input.reservaId}` },
      rodape: 'Você recebe este e-mail porque fez uma reserva no Boatzy.',
    }),
    'reembolso',
  );
}

/* ── Gestor: status de pagamento que dependem do cliente (SPEC §87) ── */

type DadosGestorEmail = DadosPedidoEmail & { para: string; nome: string; clienteNome: string };

const botaoPainel = (reservaId: string) => ({ texto: 'Ver no painel', url: `${baseUrl()}/painel/agendamentos/${reservaId}` });
const RODAPE_GESTOR = 'Você recebe este e-mail porque é gestor no Boatzy.';

/** Gestor: o cliente não pagou dentro do prazo — a data voltou a ficar livre. */
export async function emailGestorPedidoExpirado(input: DadosGestorEmail) {
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
        `O pagamento de <strong>${esc(input.clienteNome)}</strong> para <strong>${esc(input.itemNome)}</strong> não foi aprovado pela operadora.`,
        input.expiraEm
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
        `${input.parcial ? 'Parte do valor' : 'O valor'} do pedido de <strong>${esc(input.clienteNome)}</strong> para <strong>${esc(input.itemNome)}</strong> foi estornado ao cliente.`,
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
  );
}
