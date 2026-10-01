import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { addRole } from '@/lib/roles';
import { cookies } from 'next/headers';
import { COOKIE_DESTINO_PAINEL, destinoPainelSeguro } from '@/lib/painel-destino';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

type UserInsert = Database['public']['Tables']['users']['Insert'];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/painel/login', APP_URL));
  }

  const email = user.email ?? '';
  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email.split('@')[0];
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  // Upsert do usuário — o id coincide com auth.users.id
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    const userData: UserInsert = {
      id: user.id,
      name,
      email,
      avatar_url: avatarUrl,
    };
    await supabaseAdmin.from('users').insert(userData);
  } else {
    await supabaseAdmin
      .from('users')
      .update({ avatar_url: avatarUrl, name })
      .eq('id', user.id);
  }

  await addRole(user.id, 'gestor');

  // Volta para a página que o gestor tentou abrir antes do login (ex.: link de e-mail).
  const cookieStore = await cookies();
  const bruto = cookieStore.get(COOKIE_DESTINO_PAINEL)?.value;
  const destino = destinoPainelSeguro(bruto ? decodeURIComponent(bruto) : null) ?? '/painel';
  const resposta = NextResponse.redirect(new URL(destino, APP_URL));
  if (bruto) resposta.cookies.set(COOKIE_DESTINO_PAINEL, '', { path: '/', maxAge: 0 });
  return resposta;
}
