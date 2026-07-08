import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Confirma tokens enviados por e-mail para a recuperação de senha do site.
// /recuperar-senha usa um client com flowType 'implicit' (não o client PKCE compartilhado)
// exatamente para que o token_hash aqui NÃO venha prefixado com "pkce_" — assim o link
// funciona em qualquer navegador/dispositivo, sem depender de cookie do navegador de origem.
// O ramo `pkce_` abaixo é só um fallback defensivo (ex.: token pkce recebido de alguma
// forma inesperada); nesse caso exchangeCodeForSession só funciona no mesmo navegador
// que originou o pedido, pois depende do code_verifier salvo em cookie local.
// Equivalente do painel: /painel/auth/confirm (rota separada, mesmo padrão do
// /auth/callback vs /painel/auth/callback já usados no OAuth).
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
  const { searchParams } = requestUrl;
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // Fallback para o template padrão do Supabase ({{ .ConfirmationURL }}), que chega como ?code=
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/redefinir-senha';
  // Aceita apenas caminhos relativos para evitar open redirect.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = token_hash.startsWith('pkce_')
      ? await supabase.auth.exchangeCodeForSession(token_hash)
      : await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL('/recuperar-senha?error=link-invalido', origin));
}
