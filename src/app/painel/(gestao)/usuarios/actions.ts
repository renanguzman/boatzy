'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { UserRole } from '@/types/supabase';

export type CreateUserState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export async function createUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== 'gestor' && role !== 'admin') {
    return { status: 'error', message: 'Acesso não autorizado.' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const cpf_cnpj = (formData.get('cpf_cnpj') as string) || null;
  const birthday = (formData.get('birthday') as string) || null;
  const userRole = (formData.get('role') as UserRole) ?? 'gestor';

  if (!name || !email || !password) {
    return { status: 'error', message: 'Nome, e-mail e senha são obrigatórios.' };
  }

  // 1. Criar usuário no Clerk
  const client = await clerkClient();
  let clerkUser;
  try {
    const [firstName, ...rest] = name.trim().split(' ');
    clerkUser = await client.users.createUser({
      firstName,
      lastName: rest.join(' ') || undefined,
      emailAddress: [email],
      password,
      publicMetadata: { role: userRole },
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Erro ao criar usuário no Clerk.';
    return { status: 'error', message: msg };
  }

  // 2. Persistir no Supabase (users)
  const { data: dbUser, error: dbError } = await supabaseAdmin
    .from('users')
    .insert({
      id_clerk: clerkUser.id,
      name,
      email,
      cpf_cnpj,
      birthday: birthday || null,
      avatar_url: clerkUser.imageUrl ?? null,
    })
    .select('id')
    .single();

  if (dbError || !dbUser) {
    // Rollback: remover usuário do Clerk
    await client.users.deleteUser(clerkUser.id).catch(() => null);
    return {
      status: 'error',
      message: `Erro ao salvar no banco: ${dbError?.message ?? 'Desconhecido'}`,
    };
  }

  // 3. Inserir role na tabela user_roles
  await supabaseAdmin.from('user_roles').insert({
    user_id: dbUser.id,
    role: userRole,
  });

  return {
    status: 'success',
    message: `Usuário "${name}" criado com sucesso.`,
  };
}
