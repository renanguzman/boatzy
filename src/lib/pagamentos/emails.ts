import 'server-only';

import { sendEmail } from '@/lib/email';
import { FUSO_HORARIO } from '@/lib/datas';

/**
 * E-mails do fluxo de pagamento (mesmo layout do aviso de conversas —
 * `src/lib/notificacoes-conversa.ts`). Falha no envio é logada e nunca
 * interrompe o fluxo de pagamento.
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://boatzy.app').trim().replace(/\/+$/, '');
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function dataBR(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

function montarHtml(input: {
  nome: string;
  paragrafos: string[]; // HTML já escapado
  linhas: [string, string][]; // rótulo, valor (texto puro)
  botao?: { texto: string; url: string };
  rodape: string;
}): string {
  const primeiroNome = esc((input.nome ?? '').split(' ')[0] || 'Olá');
  const linhas = input.linhas
    .map(
      ([rotulo, valor]) => `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;color:#64748b;font-size:13px;">${esc(rotulo)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;color:#0B2447;font-size:13px;font-weight:bold;text-align:right;">${esc(valor)}</td>
      </tr>`,
    )
    .join('');
  const botao = input.botao
    ? `<a href="${esc(input.botao.url)}" style="display:inline-block;background:#0B3D91;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:12px;">${esc(input.botao.texto)}</a>`
    : '';
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0B2447;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:bold;">Boatzy</td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px;color:#0B2447;font-size:18px;">Olá, ${primeiroNome}!</h1>
          ${input.paragrafos.map((p) => `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5;">${p}</p>`).join('')}
          ${linhas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:12px;overflow:hidden;margin-bottom:20px;">${linhas}</table>` : ''}
          ${botao}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #eef2f7;color:#94a3b8;font-size:12px;line-height:1.5;">${esc(input.rodape)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function enviar(to: string | null | undefined, subject: string, html: string, contexto: string) {
  if (!to) return;
  const r = await sendEmail({ to, subject, html });
  if (!r.ok && r.error !== 'no_provider') console.error(`[pagamentos/emails] ${contexto}:`, r.error);
}

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
