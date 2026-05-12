import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

type UserInsert = Database['public']['Tables']['users']['Insert'];
type RoleInsert = Database['public']['Tables']['user_roles']['Insert'];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL('/painel/login', APP_URL));
  }

  const clerk = await clerkClient();

  // 1. Atribuir role 'gestor' no Clerk publicMetadata
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { role: 'gestor' },
  });

  // 2. Inserir/atualizar usuário no Supabase
  const user = await currentUser();
  if (user) {
    const userData: UserInsert = {
      id_clerk: userId,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Sem nome',
      email: user.emailAddresses[0]?.emailAddress ?? '',
      avatar_url: user.imageUrl ?? null,
    };

    // Upsert do usuário
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .upsert(userData, { onConflict: 'id_clerk' })
      .select('id')
      .single();

    // Inserir role 'gestor' na tabela user_roles (ignora se já existir)
    if (dbUser) {
      const roleData: RoleInsert = {
        user_id: dbUser.id,
        role: 'gestor',
      };
      await supabaseAdmin
        .from('user_roles')
        .upsert(roleData, { onConflict: 'user_id,role' });
    }
  }

  // 3. Redirecionar para a página de refresh de sessão
  return NextResponse.redirect(new URL('/painel/auth/atualizando', APP_URL));
}
