'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { checkRoleInDb } from '@/lib/roles';
import {
  cancelarCobrancaAvulsa, criarCobrancaAvulsa, registrarLinkCopiado,
  type CriarCobrancaAvulsaInput, type CriarCobrancaAvulsaResultado,
} from '@/lib/pagamentos/avulso';

/** Cobrança avulsa no detalhe da reserva (SPEC §34.16) — só o gestor dono da reserva. */

async function gestorLogado(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (await checkRoleInDb(user.id, ['gestor', 'admin'])) ? user.id : null;
}

function revalidar(reservaId: string) {
  revalidatePath(`/painel/agendamentos/${reservaId}`);
  revalidatePath('/painel/agendamentos');
  revalidatePath('/painel/receitas');
  revalidatePath('/minhas-reservas');
  revalidatePath(`/minhas-reservas/${reservaId}`);
}

export async function emitirCobrancaAvulsa(
  input: Omit<CriarCobrancaAvulsaInput, 'gestorId'>,
): Promise<CriarCobrancaAvulsaResultado> {
  const gestorId = await gestorLogado();
  if (!gestorId) return { ok: false, error: 'Acesso não autorizado.' };
  const r = await criarCobrancaAvulsa({ ...input, gestorId });
  if (r.ok) revalidar(input.reservaId);
  return r;
}

export async function cancelarCobrancaAvulsaGestor(input: {
  reservaId: string;
  pedidoId: string;
  motivo: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gestorId = await gestorLogado();
  if (!gestorId) return { ok: false, error: 'Acesso não autorizado.' };
  const r = await cancelarCobrancaAvulsa({
    pedidoId: input.pedidoId,
    gestorId,
    ator: { id: gestorId, papel: 'gestor' },
    motivo: input.motivo || 'Cancelada pelo gestor',
  });
  if (r.ok) revalidar(input.reservaId);
  return r;
}

/** Rastreio do compartilhamento do link (copiar / WhatsApp). */
export async function registrarCompartilhamentoCobranca(pedidoId: string, canal: 'copiar' | 'whatsapp'): Promise<void> {
  const gestorId = await gestorLogado();
  if (gestorId) await registrarLinkCopiado(pedidoId, gestorId, canal);
}
