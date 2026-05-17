'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { addRole, checkRoleInDb } from '@/lib/roles';
import type { UserRole } from '@/types/supabase';

export type CreateUserState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export async function createUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller) return { status: 'error', message: 'Não autenticado.' };

  const autorizado = await checkRoleInDb(caller.id, ['gestor', 'admin']);
  if (!autorizado) return { status: 'error', message: 'Acesso não autorizado.' };

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const cpf_cnpj = (formData.get('cpf_cnpj') as string) || null;
  const birthday = (formData.get('birthday') as string) || null;
  const userRole = (formData.get('role') as UserRole) ?? 'gestor';

  if (!name || !email || !password) {
    return { status: 'error', message: 'Nome, e-mail e senha são obrigatórios.' };
  }

  // 1. Criar usuário no Supabase Auth via admin API
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError || !authData.user) {
    return {
      status: 'error',
      message: translateAuthError(authError?.message ?? 'Erro ao criar usuário.'),
    };
  }

  const newAuthUser = authData.user;

  // 2. Persistir no Supabase (users)
  const { error: dbError } = await supabaseAdmin
    .from('users')
    .insert({
      id: newAuthUser.id,
      name,
      email,
      cpf_cnpj,
      birthday: birthday || null,
      avatar_url: null,
    });

  if (dbError) {
    // Rollback: remover usuário do Auth
    await supabaseAdmin.auth.admin.deleteUser(newAuthUser.id).catch(() => null);
    return {
      status: 'error',
      message: `Erro ao salvar no banco: ${dbError.message}`,
    };
  }

  // 3. Adicionar role
  await addRole(newAuthUser.id, userRole);

  return {
    status: 'success',
    message: `Usuário "${name}" criado com sucesso.`,
  };
}

function translateAuthError(message: string): string {
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Este e-mail já possui uma conta.';
  }
  if (message.includes('Password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (message.includes('Unable to validate email')) {
    return 'E-mail inválido.';
  }
  return message;
}
