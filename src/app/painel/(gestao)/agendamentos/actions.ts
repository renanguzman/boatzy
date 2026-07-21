'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { getDatasReservadasEmbarcacao, getDatasReservadasRoteiro } from '@/lib/reservas';

type ActionResult = { ok: boolean; error?: string };

const CONFLITO_MSG = 'Não é possível confirmar: já existe outra reserva confirmada para esta data.';

type ReservaParaChecagem = {
  tipo: 'roteiro' | 'embarcacao';
  roteiro_id: string | null;
  embarcacao_id: string | null;
  data_reserva: string;
  roteiro: { embarcacao_id: string | null } | null;
};

async function responderReserva(
  reservaId: string,
  status: 'confirmada' | 'recusada',
  observacao?: string,
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
    .select('id, owner_id, status, tipo, roteiro_id, embarcacao_id, data_reserva, roteiro ( embarcacao_id )')
    .eq('id', reservaId)
    .eq('owner_id', user.id)
    .single();

  if (!reserva) return { ok: false, error: 'Reserva não encontrada ou sem permissão.' };

  const r = reserva as unknown as ReservaParaChecagem;

  // Ao CONFIRMAR: a embarcação (ou o roteiro, sempre) não pode já ter outra
  // reserva confirmada na mesma data — a própria reserva ainda está
  // pendente neste momento, então nunca aparece nesse resultado.
  if (status === 'confirmada') {
    const datasIndisponiveis =
      r.tipo === 'embarcacao'
        ? await getDatasReservadasEmbarcacao(r.embarcacao_id!)
        : await getDatasReservadasRoteiro({
            roteiroId: r.roteiro_id!,
            embarcacaoId: r.roteiro?.embarcacao_id ?? null,
          });
    if (datasIndisponiveis.includes(r.data_reserva)) {
      return { ok: false, error: CONFLITO_MSG };
    }
  }

  const { error } = await supabaseAdmin
    .from('reserva')
    .update({
      status,
      observacao_gestor: observacao?.trim() ? observacao.trim() : null,
      respondido_em: new Date().toISOString(),
    })
    .eq('id', reservaId);

  if (error) {
    // 23505 = corrida com outra confirmação simultânea (índices únicos
    // parciais reserva_embarcacao_data_confirmada_uniq /
    // reserva_roteiro_data_confirmada_uniq — rede de segurança contra race
    // condition; a checagem acima já cobre o caso não concorrente).
    if (error.code === '23505') return { ok: false, error: CONFLITO_MSG };
    return { ok: false, error: error.message };
  }

  revalidatePath('/painel/agendamentos');
  return { ok: true };
}

export async function confirmarReserva(reservaId: string, observacao?: string): Promise<ActionResult> {
  return responderReserva(reservaId, 'confirmada', observacao);
}

export async function recusarReserva(reservaId: string, observacao?: string): Promise<ActionResult> {
  return responderReserva(reservaId, 'recusada', observacao);
}
