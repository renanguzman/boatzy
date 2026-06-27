'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

type ActionResult = { ok: boolean; error?: string };

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

  // Garante posse: a reserva deve pertencer a um roteiro do gestor.
  const { data: reserva } = await supabaseAdmin
    .from('reserva')
    .select('id, owner_id, status')
    .eq('id', reservaId)
    .eq('owner_id', user.id)
    .single();

  if (!reserva) return { ok: false, error: 'Reserva não encontrada ou sem permissão.' };

  const { error } = await supabaseAdmin
    .from('reserva')
    .update({
      status,
      observacao_gestor: observacao?.trim() ? observacao.trim() : null,
      respondido_em: new Date().toISOString(),
    })
    .eq('id', reservaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel/agendamentos');
  return { ok: true };
}

export async function confirmarReserva(reservaId: string, observacao?: string): Promise<ActionResult> {
  return responderReserva(reservaId, 'confirmada', observacao);
}

export async function recusarReserva(reservaId: string, observacao?: string): Promise<ActionResult> {
  return responderReserva(reservaId, 'recusada', observacao);
}
