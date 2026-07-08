import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const painelPublicRoutes = [
  /^\/painel\/login(\/|$)/,
  /^\/painel\/cadastro(\/|$)/,
  /^\/painel\/auth(\/|$)/,
  /^\/painel\/recuperar-senha(\/|$)/,
  /^\/painel\/redefinir-senha(\/|$)/,
  /^\/api\/painel\/setup-role(\/|$)/,
];

function isPainelPublic(pathname: string) {
  return painelPublicRoutes.some((re) => re.test(pathname));
}

export async function proxy(request: NextRequest) {
  // Cria a resposta base e o cliente Supabase SSR que lê/escreve cookies.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propaga os cookies atualizados tanto na request quanto na response.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: getUser() é obrigatório aqui para que o middleware
  // possa renovar tokens de sessão expirados nos cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protege rotas do painel — redireciona para login se não autenticado.
  if (
    pathname.startsWith('/painel') &&
    !isPainelPublic(pathname) &&
    !user
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/painel/login';
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
