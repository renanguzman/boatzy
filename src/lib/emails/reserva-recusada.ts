import 'server-only';

import { formatarData } from '@/lib/datas';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from './layout';

/**
 * E-mail gentil ao cliente quando o gestor recusa a solicitação de reserva —
 * inclusive quando a data foi ocupada por outra reserva do mesmo barco (o
 * gestor decide qual pedido aceitar; os demais recebem este aviso). Nenhum
 * valor é cobrado de uma solicitação pendente, e o e-mail convida o cliente a
 * escolher outra data no mesmo roteiro. Falha no envio só é logada.
 */
export async function emailReservaRecusada(input: {
  /** Registra o envio na linha do tempo de comunicações da reserva (SPEC §96). */
  reservaId: string;
  para: string | null | undefined;
  nome: string;
  itemNome: string;
  /** Roteiro da reserva — o botão leva ao calendário dele. null = reserva de embarcação. */
  roteiroId: string | null;
  dataReserva: string; // AAAA-MM-DD
  dataFimReserva: string | null;
  /** Mensagem que o gestor escreveu ao recusar (opcional). */
  observacao: string | null;
}) {
  const periodo = input.dataFimReserva && input.dataFimReserva !== input.dataReserva
    ? `${formatarData(input.dataReserva)} a ${formatarData(input.dataFimReserva)}`
    : formatarData(input.dataReserva, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const paragrafos = [
    `Agradecemos muito o seu interesse em <strong>${esc(input.itemNome)}</strong>. Infelizmente, desta vez não foi possível confirmar a sua reserva para <strong>${esc(periodo)}</strong>.`,
    ...(input.observacao
      ? [`O responsável pelo passeio deixou esta mensagem para você: <em>“${esc(input.observacao)}”</em>`]
      : []),
    'Fique tranquilo: nenhum valor foi cobrado. Que tal escolher outra data? Muitas vezes há dias livres bem próximos.',
  ];

  const url = input.roteiroId ? `${baseUrl()}/roteiros/${input.roteiroId}` : `${baseUrl()}/buscar`;
  await enviarEmail(
    input.para,
    'Não foi possível confirmar sua reserva — escolha outra data',
    montarEmailHtml({
      nome: input.nome,
      paragrafos,
      blocos: [{ linhas: [['Passeio', input.itemNome], ['Data solicitada', periodo]] }],
      botao: { texto: input.roteiroId ? 'Ver outras datas' : 'Buscar passeios', url },
      rodape: 'Você recebe este e-mail porque solicitou uma reserva no Boatzy.',
    }),
    'reserva recusada',
    { reservaId: input.reservaId, papel: 'cliente', tipo: 'reserva_recusada' },
  );
}
