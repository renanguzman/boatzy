'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Mail, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { resetPasswordClient } from '@/lib/supabase/reset-password-client';

function RecuperarSenhaForm() {
  const searchParams = useSearchParams();
  const t = useTranslations('RecuperarSenha');
  const tAuth = useTranslations('Auth');
  const tRaiz = useTranslations();

  // `error=link-invalido` chega do /auth/confirm quando o link do e-mail expirou ou já foi usado
  const [email, setEmail] = useState('');
  const [error, setError] = useState(
    searchParams.get('error') === 'link-invalido'
      ? t('linkInvalido')
      : ''
  );
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await resetPasswordClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl()}/auth/confirm`,
    });

    if (authError) {
      setError(tRaiz(translateError(authError)));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-turquesa/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-turquesa" />
        </div>
        <h2 className="text-xl font-bold text-marinho mb-2">{tAuth('verifiqueEmail')}</h2>
        <p className="text-slate-500 text-sm mb-6">
          {t.rich('seExistir', { email, b: (texto) => <strong>{texto}</strong> })}
        </p>
        <Link href="/entrar" className="text-marinho text-sm font-medium hover:underline">
          {t('voltarLogin')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold text-marinho mb-2">{t('titulo')}</h1>
      <p className="text-slate-500 text-sm mb-6">
        {t('texto')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-marinho tracking-wider uppercase mb-2">
            {tAuth('email')}
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tAuth('emailPlaceholder')}
              required
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho transition-all"
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
          className="w-full flex items-center justify-center gap-2 bg-marinho hover:bg-marinho-escuro text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-marinho/20"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {t('enviar')}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/entrar"
          className="inline-flex items-center gap-1 text-sm text-marinho font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('voltarLogin')}
        </Link>
      </div>
    </>
  );
}

export default function RecuperarSenhaPage() {
  const t = useTranslations('RecuperarSenha');
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-areia px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <Image
              src="/images/logo.png"
              alt="Boatzy"
              width={952}
              height={817}
              className="h-12 w-auto mx-auto object-contain"
            />
          </Link>
          <p className="text-slate-500 text-sm mt-3">
            {t('subtitulo')}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
            <RecuperarSenhaForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// URL base do app: usa NEXT_PUBLIC_APP_URL (domínio de produção, ex.: https://www.boatzy.app)
// e cai para window.location.origin apenas em ambientes sem a env configurada.
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
}

/** Erro do Supabase Auth → chave da mensagem. */
function translateError(error: { code?: string; message: string }) {
  if (
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit' ||
    error.message.includes('rate limit') ||
    error.message.includes('Too many requests')
  ) {
    return 'RecuperarSenha.erros.muitas' as const;
  }
  if (error.code === 'email_address_invalid' || error.message.includes('Unable to validate email')) {
    return 'Auth.erros.emailInvalido' as const;
  }
  return 'RecuperarSenha.erros.falha' as const;
}
