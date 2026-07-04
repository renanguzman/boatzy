'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Cancelamento pelo CLIENTE: permitido enquanto a reserva está 'pendente' ou
 * 'confirmada'. Difere de 'recusada' (negativa do gestor). Grava cancelada_em.
 */
export async function cancelarReserva(reservaId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessão expirada. Faça login novamente.' };

  const { data: reserva } = await supabaseAdmin
    .from('reserva')
    .select('id, cliente_id, status')
    .eq('id', reservaId)
    .single();

  if (!reserva || reserva.cliente_id !== user.id) {
    return { ok: false, error: 'Reserva não encontrada.' };
  }
  if (reserva.status !== 'pendente' && reserva.status !== 'confirmada') {
    return { ok: false, error: 'Esta reserva não pode mais ser cancelada.' };
  }

  const { error } = await supabaseAdmin
    .from('reserva')
    .update({ status: 'cancelada', cancelada_em: new Date().toISOString() })
    .eq('id', reservaId);

  if (error) {
    console.error('[cancelarReserva] falha:', error);
    return { ok: false, error: 'Erro ao cancelar a reserva. Tente novamente.' };
  }

  revalidatePath('/minhas-reservas');
  revalidatePath('/painel/agendamentos');
  return { ok: true };
}

/**
 * Avaliação pelo CLIENTE: apenas reservas 'concluida', uma avaliação por
 * reserva (UNIQUE reserva_id). roteiro_id/embarcacao_id são copiados da
 * reserva para consulta direta nas páginas públicas.
 */
export async function criarAvaliacao(
  reservaId: string,
  nota: number,
  comentario: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessão expirada. Faça login novamente.' };

  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return { ok: false, error: 'Escolha uma nota de 1 a 5 estrelas.' };
  }
  const texto = comentario.trim();
  if (texto.length > 2000) {
    return { ok: false, error: 'O comentário pode ter no máximo 2000 caracteres.' };
  }

  const { data: reserva } = await supabaseAdmin
    .from('reserva')
    .select('id, cliente_id, status, roteiro_id, embarcacao_id')
    .eq('id', reservaId)
    .single();

  if (!reserva || reserva.cliente_id !== user.id) {
    return { ok: false, error: 'Reserva não encontrada.' };
  }
  if (reserva.status !== 'concluida') {
    return { ok: false, error: 'Apenas reservas concluídas podem ser avaliadas.' };
  }

  const { error } = await supabaseAdmin.from('avaliacao').insert({
    reserva_id: reservaId,
    cliente_id: user.id,
    roteiro_id: reserva.roteiro_id,
    embarcacao_id: reserva.embarcacao_id,
    nota,
    comentario: texto || null,
  });

  if (error) {
    // 23505 = unique_violation (avaliação já existe para a reserva)
    if (error.code === '23505') {
      return { ok: false, error: 'Você já avaliou esta reserva.' };
    }
    console.error('[criarAvaliacao] falha:', error);
    return { ok: false, error: 'Erro ao enviar a avaliação. Tente novamente.' };
  }

  revalidatePath('/minhas-reservas');
  if (reserva.roteiro_id) revalidatePath(`/roteiros/${reserva.roteiro_id}`);
  if (reserva.embarcacao_id) revalidatePath(`/embarcacoes/${reserva.embarcacao_id}`);
  return { ok: true };
}
