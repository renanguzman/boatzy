'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { resetPasswordClient } from '@/lib/supabase/reset-password-client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function PainelRecuperarSenhaForm() {
  const searchParams = useSearchParams();

  // `error=link-invalido` chega do /auth/confirm quando o link do e-mail expirou ou já foi usado
  const [email, setEmail] = useState('');
  const [error, setError] = useState(
    searchParams.get('error') === 'link-invalido'
      ? 'O link de recuperação é inválido ou expirou. Solicite um novo abaixo.'
      : ''
  );
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await resetPasswordClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/painel/auth/confirm`,
    });

    if (authError) {
      setError(translateError(authError));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2447] mb-2">Verifique seu e-mail</h2>
        <p className="text-slate-500 text-sm mb-6">
          Se existir uma conta para <strong>{email}</strong>, enviamos um link para redefinir sua
          senha. Confira também a caixa de spam.
        </p>
        <Link href="/painel/login" className="text-[#0B3D91] text-sm font-medium hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0B2447] mb-1">Recuperar senha</h1>
      <p className="text-slate-500 text-sm mb-8">
        Informe o e-mail da sua conta no Portal de Gestão e enviaremos um link para redefinir a senha.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase mb-2">
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@boatzy.com"
              required
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#0B2447]/20 hover:shadow-[#0B3D91]/30"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Enviar link de recuperação
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/painel/login"
          className="inline-flex items-center gap-1 text-sm text-[#0B3D91] font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </Link>
      </div>
    </>
  );
}

export default function PainelRecuperarSenhaPage() {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Hero — visível apenas em desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="/images/lancha_bg_painel.png"
          alt="Iate ao pôr do sol"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/80 via-[#0B2447]/30 to-transparent" />
        <div className="absolute top-10 left-10 z-20">
          <Image src="/images/logo-white.png" alt="Boatzy" width={200} height={60} className="h-14 w-auto" priority />
        </div>
        <div className="absolute bottom-12 left-10 right-10 z-10">
          <p className="text-white/90 font-semibold text-lg italic mb-2">Precisão em cada nó.</p>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Gerencie as charters marítimas mais exclusivas com a suíte administrativa Boatzy.
          </p>
          <p className="mt-6 text-xs font-bold tracking-[0.3em] text-cyan-400/80 uppercase">Excelência Marítima</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex flex-col justify-between px-8 py-10 lg:px-16 xl:px-24">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="flex items-center gap-2.5 mb-10">
            <Image src="/images/logo.png" alt="Boatzy" width={200} height={60} className="h-12 w-auto" priority />
          </div>

          <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
            <PainelRecuperarSenhaForm />
          </Suspense>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-8 border-t border-slate-100 mt-8">
          <p>© {new Date().getFullYear()} BOATZY MARITIME SYSTEMS</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-600 cursor-pointer transition-colors">PRIVACIDADE</span>
            <span className="hover:text-slate-600 cursor-pointer transition-colors">SEGURANÇA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function translateError(error: { code?: string; message: string }): string {
  if (
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit' ||
    error.message.includes('rate limit') ||
    error.message.includes('Too many requests')
  ) {
    return 'Muitas solicitações. Aguarde alguns minutos e tente novamente.';
  }
  if (error.code === 'email_address_invalid' || error.message.includes('Unable to validate email')) {
    return 'E-mail inválido.';
  }
  return 'Não foi possível enviar o e-mail. Tente novamente.';
}
