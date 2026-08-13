'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

type ActionResult = { ok: boolean; error?: string };

async function requireAdmin(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };

  return { ok: true };
}

/** Converte string do form em number|null, aceitando vírgula decimal. */
function paraNumero(v: string): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Validação comum das duas telas (taxa geral e taxa específica). */
function validarPercent(percent: number | null): string | null {
  if (percent === null) return 'Informe a taxa em porcentagem.';
  if (percent < 0 || percent > 100) return 'A taxa deve estar entre 0% e 100%.';
  return null;
}

/** Atualiza o registro singleton — taxa geral vigente da plataforma (ver SPEC §14). */
export async function atualizarTaxaGeral(percentInput: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const percent = paraNumero(percentInput);
  const erroValidacao = validarPercent(percent);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const { error } = await supabaseAdmin
    .from('taxa_plataforma')
    // validarPercent já garantiu que percent não é null neste ponto.
    .update({ taxa_percent: percent! })
    .eq('singleton', true);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/taxas');
  return { ok: true };
}

export type TaxaGestorPayload = {
  userId: string;
  taxaPercent: string;
  ativo: boolean;
  dataValidade: string; // '' = sem expiração
  observacao: string;
};

/**
 * Cria ou atualiza a taxa específica de um gestor (`usuario_taxa`, UNIQUE
 * por user_id) — pode ser maior ou menor que a taxa geral.
 */
export async function salvarTaxaGestor(payload: TaxaGestorPayload): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!payload.userId) return { ok: false, error: 'Gestor inválido.' };

  const percent = paraNumero(payload.taxaPercent);
  const erroValidacao = validarPercent(percent);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const { error } = await supabaseAdmin.from('usuario_taxa').upsert(
    {
      user_id: payload.userId,
      // validarPercent já garantiu que percent não é null neste ponto.
      taxa_percent: percent!,
      ativo: payload.ativo,
      data_validade: payload.dataValidade || null,
      observacao: payload.observacao.trim() || null,
    },
    { onConflict: 'user_id' },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/taxas');
  return { ok: true };
}

/** Remove a taxa específica de um gestor — volta a valer a taxa geral pra ele. */
export async function removerTaxaGestor(userId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { error } = await supabaseAdmin.from('usuario_taxa').delete().eq('user_id', userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/administrator/taxas');
  return { ok: true };
}
