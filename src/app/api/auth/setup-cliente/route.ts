import { auth, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { addRole, syncRolesToClerk } from '@/lib/roles';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

type UserInsert = Database['public']['Tables']['users']['Insert'];

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

  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/', APP_URL));
  }

  const email = user.emailAddresses[0]?.emailAddress ?? '';

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let dbUserId: string | null = null;

  if (existingUser) {
    await supabaseAdmin
      .from('users')
      .update({ id_clerk: userId })
      .eq('id', existingUser.id);
    dbUserId = existingUser.id;
  } else {
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

  if (dbUserId) {
    await addRole(dbUserId, 'cliente');
  }

  await syncRolesToClerk(userId);

  return NextResponse.redirect(new URL(redirectTo, APP_URL));
}
