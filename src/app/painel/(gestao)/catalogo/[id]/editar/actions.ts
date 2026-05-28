'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { CatalogoTipo } from '@/types/supabase';

export type AtualizarCatalogoPayload = {
  descricao: string;
  valor: string;
  tipo: CatalogoTipo;
};

type ActionResult = { ok: boolean; error?: string };

async function getAuthorizedItem(catalogoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { error: 'Acesso não autorizado.' };

  const { data: item } = await supabaseAdmin
    .from('catalogo')
    .select('id')
    .eq('id', catalogoId)
    .eq('owner_id', user.id)
    .eq('is_boatzy', false)
    .single();

  if (!item) return { error: 'Item não encontrado ou sem permissão.' };

  return { ok: true as const };
}

export async function atualizarCatalogo(
  catalogoId: string,
  payload: AtualizarCatalogoPayload,
): Promise<ActionResult> {
  const result = await getAuthorizedItem(catalogoId);
  if ('error' in result && result.error) return { ok: false, error: result.error };

  if (!payload.descricao.trim()) return { ok: false, error: 'A descrição é obrigatória.' };
  if (!payload.valor || parseFloat(payload.valor) < 0) return { ok: false, error: 'O valor deve ser maior ou igual a zero.' };

  const { error } = await supabaseAdmin
    .from('catalogo')
    .update({
      descricao: payload.descricao.trim(),
      valor: parseFloat(payload.valor),
      tipo: payload.tipo,
    })
    .eq('id', catalogoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
