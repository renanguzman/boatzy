import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { UserRole } from '@/types/supabase';

/**
 * Lê todas as roles do usuário no Supabase a partir do clerk user id.
 * Retorna [] se o usuário ainda não existir na tabela `users`.
 */
export async function getRolesFromDb(clerkUserId: string): Promise<UserRole[]> {
  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_clerk', clerkUserId)
    .maybeSingle();

  if (!dbUser) return [];

  const { data: rows } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', dbUser.id);

  return (rows ?? []).map((r) => r.role);
}

/**
 * Espelha as roles do Supabase em `publicMetadata.roles` no Clerk.
 * O Supabase é a fonte da verdade; o Clerk é cache que o middleware lê do JWT.
 */
export async function syncRolesToClerk(clerkUserId: string): Promise<UserRole[]> {
  const roles = await getRolesFromDb(clerkUserId);
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { roles },
  });
  return roles;
}

/**
 * Adiciona uma role ao usuário (idempotente) e re-sincroniza o Clerk.
 * Requer que o registro em `users` já exista — caller deve garantir o upsert antes.
 */
export async function addRole(dbUserId: string, role: UserRole): Promise<void> {
  await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: dbUserId, role }, { onConflict: 'user_id,role' });
}

/**
 * Helper para checar role a partir das sessionClaims (server components / middleware).
 */
export function hasRole(
  claims: CustomJwtSessionClaims | null | undefined,
  role: UserRole,
): boolean {
  return (claims?.metadata?.roles ?? []).includes(role);
}
