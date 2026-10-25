import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { formatarData } from '@/lib/datas';
import { baseUrl, enviarEmail, esc, montarEmailHtml } from './layout';

/**
 * E-mails ao gestor sobre a reserva que não passam pelo pagamento online
 * (o aviso in-app correspondente é gravado pelo trigger `notificacao_reserva`,
 * SPEC §87). Carregam os dados pela reserva; falha no envio só é logada.
 */

type DadosReserva = {
  item_nome: string;
  data_reserva: string;
  data_fim_reserva: string | null;
  quantidade_pessoas: number;
  owner_id: string;
  roteiro: { nome: string } | null;
  cliente: { name: string | null } | null;
  gestor: { name: string | null; email: string | null } | null;
};

async function carregar(reservaId: string): Promise<DadosReserva | null> {
  const { data } = await supabaseAdmin
    .from('reserva')
    .select(
      `item_nome, data_reserva, data_fim_reserva, quantidade_pessoas, owner_id, roteiro ( nome ),
       cliente:users!reserva_cliente_id_fkey ( name )`,
    )
    .eq('id', reservaId)
    .maybeSingle();
  if (!data) return null;
  const { data: gestor } = await supabaseAdmin.from('users').select('name, email').eq('id', data.owner_id).maybeSingle();
  return { ...(data as unknown as Omit<DadosReserva, 'gestor'>), gestor: gestor ?? null };
}

function periodo(r: DadosReserva): string {
  return r.data_fim_reserva && r.data_fim_reserva !== r.data_reserva
    ? `${formatarData(r.data_reserva)} a ${formatarData(r.data_fim_reserva)}`
    : formatarData(r.data_reserva, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** O cliente cancelou a reserva (pendente, aguardando pagamento ou confirmada sem cobrança online). */
export async function emailGestorReservaCancelada(reservaId: string) {
  const r = await carregar(reservaId);
  if (!r) return;
  const item = r.roteiro?.nome ?? r.item_nome;
  const cliente = r.cliente?.name?.trim() || 'O cliente';
  await enviarEmail(
    r.gestor?.email,
    `Reserva cancelada pelo cliente — ${item} em ${formatarData(r.data_reserva)}`,
    montarEmailHtml({
      nome: r.gestor?.name ?? '',
      paragrafos: [
        `<strong>${esc(cliente)}</strong> cancelou a reserva de <strong>${esc(item)}</strong> para <strong>${esc(periodo(r))}</strong>.`,
        'Nenhum valor foi cobrado por esta reserva.',
      ],
      blocos: [{
        linhas: [
          ['Cliente', cliente],
          ['Passeio', item],
          ['Data', periodo(r)],
          ['Pessoas', String(r.quantidade_pessoas)],
        ],
      }],
      botao: { texto: 'Ver no painel', url: `${baseUrl()}/painel/agendamentos/${reservaId}` },
      rodape: `Você recebe este e-mail porque é o gestor de ${item} no Boatzy.`,
    }),
    'reserva cancelada (gestor)',
  );
}
