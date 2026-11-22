import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { detalharErro, logAuth } from '@/lib/log-auth';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
  const { searchParams } = requestUrl;
  const code = searchParams.get('code');
  // Erro devolvido pelo provedor/Supabase (ex.: Apple/Facebook mal configurados, e-mail não enviado no cadastro).
  const erroProvedor = searchParams.get('error_description') ?? searchParams.get('error');
  if (erroProvedor) {
    logAuth('callback:erro-do-provedor', 'error', {
      erro: searchParams.get('error'), codigo: searchParams.get('error_code'), descricao: erroProvedor,
    });
  }
  const rawNext = searchParams.get('next') ?? '/';
  // Aceita apenas caminhos relativos para evitar open redirect.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (!code) {
    logAuth('callback:sem-code', 'warn', { temErroProvedor: !!erroProvedor });
    return NextResponse.redirect(new URL('/', origin));
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
    logAuth('callback:exchange-erro', 'error', detalharErro(error));
    return NextResponse.redirect(new URL('/', origin));
  }

  logAuth('callback:ok', 'info', { next });
  return NextResponse.redirect(new URL(next, origin));
}
