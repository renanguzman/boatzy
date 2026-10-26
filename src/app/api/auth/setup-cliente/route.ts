import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { COOKIE_IDIOMA, OPCOES_COOKIE_IDIOMA, isIdioma } from '@/i18n/config';
import { addRole } from '@/lib/roles';
import type { Database } from '@/types/supabase';

export const dynamic = 'force-dynamic';

type UserInsert = Database['public']['Tables']['users']['Insert'];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get('redirect_to') ?? '/';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/', APP_URL));
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

  // CPF e telefone só existem no metadata quando a conta é criada por e-mail
  // em /entrar. Contas via SSO (Google/Facebook/Apple) não trazem esses dados
  // e ficam NULL — preenchidos depois em "Minha conta".
  const cpf = (user.user_metadata?.cpf as string | undefined) ?? null;
  const phone = (user.user_metadata?.phone as string | undefined) ?? null;

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
      cpf_cnpj: cpf,
      phone,
    };
    await supabaseAdmin.from('users').insert(userData);
  } else {
    await supabaseAdmin
      .from('users')
      .update({ avatar_url: avatarUrl, name })
      .eq('id', user.id);
  }

  await addRole(user.id, 'cliente');
  await sincronizarIdioma(user.id);

  return NextResponse.redirect(new URL(redirectTo, APP_URL));
}

/**
 * Idioma no login (SPEC §94.2) — vale a escolha mais recente: cookie presente
 * (escolhido neste navegador) vai para o perfil; sem cookie, o do perfil vira
 * o cookie (escolhido em outro aparelho). Falhas só são registradas: o login
 * nunca depende disso.
 */
async function sincronizarIdioma(userId: string) {
  const cookieStore = await cookies();
  const doCookie = cookieStore.get(COOKIE_IDIOMA)?.value;

  const { data, error } = await supabaseAdmin.from('users').select('idioma').eq('id', userId).maybeSingle();
  if (error) {
    console.error('[setup-cliente] falha ao ler users.idioma:', error);
    return;
  }

  if (isIdioma(doCookie)) {
    if (data?.idioma === doCookie) return;
    const { error: erroUpdate } = await supabaseAdmin.from('users').update({ idioma: doCookie }).eq('id', userId);
    if (erroUpdate) console.error('[setup-cliente] falha ao gravar users.idioma:', erroUpdate);
  } else if (isIdioma(data?.idioma)) {
    cookieStore.set(COOKIE_IDIOMA, data.idioma, OPCOES_COOKIE_IDIOMA);
  }
}
