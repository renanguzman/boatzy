import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { formatarData } from '@/lib/datas';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from './layout';

/**
 * E-mails ao cliente sobre a reserva que não passam pelo pagamento online
 * (o aviso in-app correspondente é gravado pelo trigger `notificacao_reserva`,
 * SPEC §64). Carregam os dados pela reserva; falha no envio só é logada.
 */

type DadosReserva = {
  item_nome: string;
  data_reserva: string;
  data_fim_reserva: string | null;
  observacao_gestor: string | null;
  roteiro: { nome: string } | null;
  cliente: { name: string | null; email: string | null } | null;
};

async function carregar(reservaId: string): Promise<DadosReserva | null> {
  const { data } = await supabaseAdmin
    .from('reserva')
    .select('item_nome, data_reserva, data_fim_reserva, observacao_gestor, roteiro ( nome ), cliente:users!reserva_cliente_id_fkey ( name, email )')
    .eq('id', reservaId)
    .maybeSingle();
  return (data as unknown as DadosReserva | null) ?? null;
}

function periodo(r: DadosReserva): string {
  return r.data_fim_reserva && r.data_fim_reserva !== r.data_reserva
    ? `${formatarData(r.data_reserva)} a ${formatarData(r.data_fim_reserva)}`
    : formatarData(r.data_reserva, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Gestor confirmou a reserva sem cobrança online (pagamento combinado direto). */
export async function emailReservaConfirmada(reservaId: string) {
  const r = await carregar(reservaId);
  if (!r) return;
  const item = r.roteiro?.nome ?? r.item_nome;
  await enviarEmail(
    r.cliente?.email,
    `Reserva confirmada — ${item}`,
    montarEmailHtml({
      nome: r.cliente?.name ?? '',
      paragrafos: [
        `Boa notícia! O gestor confirmou sua reserva de <strong>${esc(item)}</strong>.`,
        ...(r.observacao_gestor?.trim()
          ? [`Recado do gestor: <em>“${esc(r.observacao_gestor.trim())}”</em>`]
          : []),
        'Qualquer dúvida sobre o embarque, fale com o gestor pelo chat do Boatzy.',
      ],
      blocos: [{ linhas: [['Passeio', item], ['Data', periodo(r)]] }],
      botao: { texto: 'Ver minha reserva', url: `${baseUrl()}/minhas-reservas/${reservaId}` },
      rodape: 'Você recebe este e-mail porque fez uma reserva no Boatzy.',
    }),
    'reserva confirmada',
  );
}

/** Cancelamento da reserva (comprovante para o cliente). */
export async function emailReservaCancelada(reservaId: string) {
  const r = await carregar(reservaId);
  if (!r) return;
  const item = r.roteiro?.nome ?? r.item_nome;
  await enviarEmail(
    r.cliente?.email,
    `Reserva cancelada — ${item}`,
    montarEmailHtml({
      nome: r.cliente?.name ?? '',
      paragrafos: [
        `Sua reserva de <strong>${esc(item)}</strong> para <strong>${esc(periodo(r))}</strong> foi cancelada.`,
        'Nenhum valor foi cobrado por esta reserva. Se quiser, escolha outra data ou outro passeio.',
      ],
      blocos: [{ linhas: [['Passeio', item], ['Data', periodo(r)]] }],
      botao: { texto: 'Buscar passeios', url: `${baseUrl()}/buscar` },
      rodape: 'Você recebe este e-mail porque tinha uma reserva no Boatzy.',
    }),
    'reserva cancelada',
  );
}
