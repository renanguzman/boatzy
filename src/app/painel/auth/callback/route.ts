import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_origin ?? requestUrl.origin;
  const { searchParams } = requestUrl;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/painel/login', origin));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/painel/login', origin));
  }

  // Após trocar o código, garante que o usuário existe no DB com role gestor.
  return NextResponse.redirect(new URL('/api/painel/setup-role', origin));
}
