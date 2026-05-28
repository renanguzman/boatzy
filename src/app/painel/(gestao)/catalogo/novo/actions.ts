'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { CatalogoTipo } from '@/types/supabase';

export type CriarCatalogoPayload = {
  descricao: string;
  valor: string;
  tipo: CatalogoTipo;
};

type ActionResult = { ok: boolean; error?: string };
type CriarResult = { ok: true; catalogoId: string } | { ok: false; error: string };

export async function criarCatalogo(payload: CriarCatalogoPayload): Promise<CriarResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  if (!payload.descricao.trim()) return { ok: false, error: 'A descrição é obrigatória.' };
  if (!payload.valor || parseFloat(payload.valor) < 0) return { ok: false, error: 'O valor é obrigatório e deve ser maior ou igual a zero.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  const { data, error } = await supabaseAdmin
    .from('catalogo')
    .insert({
      owner_id: user.id,
      descricao: payload.descricao.trim(),
      valor: parseFloat(payload.valor),
      tipo: payload.tipo,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Erro ao salvar item.' };

  return { ok: true, catalogoId: data.id };
}

export async function excluirCatalogo(catalogoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return { ok: false, error: 'Acesso não autorizado.' };

  const { error } = await supabaseAdmin
    .from('catalogo')
    .delete()
    .eq('id', catalogoId)
    .eq('owner_id', user.id)
    .eq('is_boatzy', false);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
