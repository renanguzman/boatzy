'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { getDatasReservadasEmbarcacao, haConflitoReservaRoteiro } from '@/lib/reservas';
import { getAtendenteOptions, resolveEmbarcacaoIdDaReserva } from '@/lib/equipe';

type ActionResult = { ok: boolean; error?: string };

const CONFLITO_MSG = 'Não é possível confirmar: já existe outra reserva confirmada para esta data.';

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

async function responderReserva(
  reservaId: string,
  status: 'confirmada' | 'recusada',
  observacao?: string,
  atendenteIds?: string[],
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
  revalidatePath(`/painel/agendamentos/${reservaId}`);
  return { ok: true };
}

export async function confirmarReserva(
  reservaId: string,
  observacao?: string,
  atendenteIds?: string[],
): Promise<ActionResult> {
  return responderReserva(reservaId, 'confirmada', observacao, atendenteIds);
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
  if (r.status !== 'confirmada' && r.status !== 'concluida') {
    return { ok: false, error: 'Só é possível definir atendentes de uma reserva confirmada.' };
  }

  const res = await definirAtendentesInterno(user.id, r, atendenteIds);
  if (!res.ok) return res;

  revalidatePath('/painel/agendamentos');
  revalidatePath(`/painel/agendamentos/${reservaId}`);
  return { ok: true };
}
