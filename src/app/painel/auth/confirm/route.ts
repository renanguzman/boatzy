import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Confirma tokens enviados por e-mail para a recuperação de senha do painel (gestor).
// Rota separada de /auth/confirm (site) — mesmo motivo do /painel/auth/callback vs
// /auth/callback já existentes no OAuth: cada superfície tem seu próprio destino fixo,
// sem precisar de um `next` dinâmico por query (o template "Reset Password" do Supabase
// é único e global, mas {{ .RedirectTo }} nele já resolve para a URL que cada tela envia).
// /painel/recuperar-senha usa um client com flowType 'implicit' (não o client PKCE
// compartilhado) para que o token_hash NÃO venha prefixado com "pkce_" — assim o link
// funciona em qualquer navegador/dispositivo, sem depender de cookie do navegador de origem.
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
  const { searchParams } = requestUrl;
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // Fallback para o template padrão do Supabase ({{ .ConfirmationURL }}), que chega como ?code=
  const code = searchParams.get('code');

  const supabase = await createClient();

  if (token_hash && type) {
    // Ramo `pkce_` é só fallback defensivo — só funciona no mesmo navegador que originou o pedido.
    const { error } = token_hash.startsWith('pkce_')
      ? await supabase.auth.exchangeCodeForSession(token_hash)
      : await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL('/painel/redefinir-senha', origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/painel/redefinir-senha', origin));
  }

  return NextResponse.redirect(new URL('/painel/recuperar-senha?error=link-invalido', origin));
}
