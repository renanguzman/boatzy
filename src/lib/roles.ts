import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import type { UserRole } from '@/types/supabase';

/**
 * Retorna as roles do usuário diretamente do banco.
 * O `userId` é o auth.users.id do Supabase (= users.id).
 */
export async function getRolesFromDb(userId: string): Promise<UserRole[]> {
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  return (data ?? []).map((r) => r.role);
}

/**
 * Adiciona uma role ao usuário (idempotente via upsert).
 * O `userId` é o auth.users.id que coincide com users.id.
 */
export async function addRole(userId: string, role: UserRole): Promise<void> {
  await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
}

/**
 * Verifica se o usuário possui ao menos uma das roles informadas.
 * Usa o banco como fonte da verdade.
 */
export async function checkRoleInDb(userId: string, roles: UserRole[]): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', roles)
    .maybeSingle();

  return !!data;
}
