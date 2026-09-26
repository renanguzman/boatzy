'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';

export type VerificacaoCadeia =
  | { ok: true; totalAceites: number; problemas: { sequencia: number; aceiteId: string; problema: string }[]; verificadoEm: string }
  | { ok: false; error: string };

/**
 * Auditoria completa da cadeia de aceites (RPC verificar_cadeia_termos_aceite):
 * recalcula o hash de cada registro e confere o encadeamento. Sem problemas = íntegra.
 */
export async function verificarCadeiaAceites(): Promise<VerificacaoCadeia> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };
  if (!(await checkRoleInDb(user.id, ['admin']))) return { ok: false, error: 'Acesso não autorizado.' };

  const [{ data, error }, { count }] = await Promise.all([
    supabaseAdmin.rpc('verificar_cadeia_termos_aceite'),
    supabaseAdmin.from('termos_uso_aceite').select('id', { count: 'exact', head: true }),
  ]);
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    totalAceites: count ?? 0,
    problemas: (data ?? []).map((p) => ({ sequencia: p.sequencia, aceiteId: p.aceite_id, problema: p.problema })),
    verificadoEm: new Date().toISOString(),
  };
}
