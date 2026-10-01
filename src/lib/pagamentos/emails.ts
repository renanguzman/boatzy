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
