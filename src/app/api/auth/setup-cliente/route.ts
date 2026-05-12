import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

type UserInsert = Database['public']['Tables']['users']['Insert'];
type RoleInsert = Database['public']['Tables']['user_roles']['Insert'];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get('redirect_to') ?? '/';
  // Aceita apenas caminhos relativos para evitar open redirect
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL('/', APP_URL));
  }

  const clerk = await clerkClient();
  const user = await currentUser();

  if (!user) {
    return NextResponse.redirect(new URL('/', APP_URL));
  }

  // Verifica se o usuário já tem uma role definida no Clerk
  const currentRole = user.publicMetadata?.role;

  // Se não tiver nenhuma role no Clerk, atribuímos 'cliente'
  if (!currentRole) {
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role: 'cliente' },
    });
  }

  const email = user.emailAddresses[0]?.emailAddress ?? '';

  // Verificar se o email já existe no Supabase
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let dbUserId: string | null = null;

  if (existingUser) {
    // Usuário já existe: apenas atualiza o id_clerk caso tenha mudado
    await supabaseAdmin
      .from('users')
      .update({ id_clerk: userId })
      .eq('id', existingUser.id);

    dbUserId = existingUser.id;
  } else {
    // Usuário novo: insere o registro completo
    const userData: UserInsert = {
      id_clerk: userId,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Sem nome',
      email,
      avatar_url: user.imageUrl ?? null,
    };

    const { data: newUser } = await supabaseAdmin
      .from('users')
      .insert(userData)
      .select('id')
      .single();

    dbUserId = newUser?.id ?? null;
  }

  // Atribuir role 'cliente' (ignora se já existir)
  if (dbUserId) {
    const roleData: RoleInsert = {
      user_id: dbUserId,
      role: 'cliente',
    };
    await supabaseAdmin
      .from('user_roles')
      .upsert(roleData, { onConflict: 'user_id,role' });
  }

  return NextResponse.redirect(new URL(redirectTo, APP_URL));
}
