'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, User, IdCard, Check, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import SocialLoginButtons, { type OAuthProvider } from '@/components/auth/SocialLoginButtons';
import PhoneInput, { type PhoneValue } from '@/components/auth/PhoneInput';
import PasswordRequirements from '@/components/auth/PasswordRequirements';
import { isStrongPassword, isValidCPF, maskCPF, onlyDigits } from '@/lib/validators';

function EntrarForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('Auth');
  const tRaiz = useTranslations();
  const locale = useLocale();

  // `redirect_to` preserva a página de origem (ex: /charters/xyz)
  const redirectTo = searchParams.get('redirect_to') ?? '/';

  const [mode, setMode] = useState<'login' | 'cadastro'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState<PhoneValue>({ e164: '', valid: false });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redireciona se já estiver logado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(redirectTo);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setError('');
    setName('');
    setEmail('');
    setCpf('');
    setPhone({ e164: '', valid: false });
    setPassword('');
    setConfirmPassword('');
    setAttemptedSubmit(false);
    setSuccess(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(tRaiz(translateError(authError.message)));
      setLoading(false);
      return;
    }

    // setup-cliente garante o registro no DB com role cliente e redireciona de volta
    const setupUrl = `/api/auth/setup-cliente?redirect_to=${encodeURIComponent(redirectTo)}`;
    window.location.href = setupUrl;
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    setError('');

    // Validações client-side antes de chamar o Supabase.
    if (!isValidCPF(cpf)) {
      setError(t('cpfInvalidoConfira'));
      return;
    }
    if (!phone.valid) {
      setError(t('celularInvalido'));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(t('senhaFraca'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('senhasDiferentes'));
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          cpf: onlyDigits(cpf),
          phone: phone.e164,
          // Idioma do e-mail de confirmação (Send Email Hook — SPEC §98).
          idioma: locale,
        },
        emailRedirectTo: `${baseUrl()}/auth/callback?next=${encodeURIComponent(
          `/api/auth/setup-cliente?redirect_to=${encodeURIComponent(redirectTo)}`
        )}`,
      },
    });

    if (authError) {
      setError(tRaiz(translateError(authError.message)));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleSocial(provider: OAuthProvider) {
    setError('');

    // Reaproveita o callback do site e o setup-cliente — garantindo a role `cliente`.
    const next = `/api/auth/setup-cliente?redirect_to=${encodeURIComponent(redirectTo)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${baseUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (authError) {
      setError(tRaiz(translateError(authError.message)));
      throw authError; // sinaliza falha ao SocialLoginButtons para limpar o loading
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-turquesa/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-turquesa" />
        </div>
        <h2 className="text-xl font-bold text-marinho mb-2">{t('verifiqueEmail')}</h2>
        <p className="text-slate-500 text-sm mb-6">
          {t.rich('enviamosLink', { email, b: (texto) => <strong>{texto}</strong> })}
        </p>
        <button
          onClick={() => { setMode('login'); resetForm(); }}
          className="text-marinho text-sm font-medium hover:underline"
        >
          {t('jaConfirmei')}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toggle login / cadastro */}
      <div className="flex rounded-xl border border-slate-200 p-1 mb-8">
        <button
          onClick={() => { setMode('login'); resetForm(); }}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            mode === 'login'
              ? 'bg-marinho text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('abaEntrar')}
        </button>
        <button
          onClick={() => { setMode('cadastro'); resetForm(); }}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            mode === 'cadastro'
              ? 'bg-marinho text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('abaCriar')}
        </button>
      </div>

      {/* Login social */}
      <div className="mb-6">
        <SocialLoginButtons onProvider={handleSocial} disabled={loading} />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">
          {mode === 'login' ? t('ouEmailEntrar') : t('ouEmailCriar')}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <form onSubmit={mode === 'login' ? handleLogin : handleCadastro} className="space-y-4">
        {mode === 'cadastro' && (
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-marinho tracking-wider uppercase mb-2">
              {t('nome')}
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('nomePlaceholder')}
                required
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho transition-all"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-xs font-bold text-marinho tracking-wider uppercase mb-2">
            {t('email')}
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho transition-all"
            />
          </div>
        </div>

        {mode === 'cadastro' && (
          <>
            <div>
              <label htmlFor="cpf" className="block text-xs font-bold text-marinho tracking-wider uppercase mb-2">
                {t('cpf')}
              </label>
              <div className="relative">
                <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className={`w-full pl-11 pr-4 py-3.5 rounded-xl border bg-slate-50/50 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho transition-all ${
                    attemptedSubmit && cpf && !isValidCPF(cpf) ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
              </div>
              {attemptedSubmit && cpf && !isValidCPF(cpf) && (
                <p className="mt-1.5 text-xs text-red-500">{t('cpfInvalido')}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-marinho tracking-wider uppercase mb-2">
                {t('celular')}
              </label>
              <PhoneInput
                onChange={setPhone}
                disabled={loading}
                invalid={attemptedSubmit && !phone.valid}
              />
              {attemptedSubmit && !phone.valid && (
                <p className="mt-1.5 text-xs text-red-500">{t('celularInvalido')}</p>
              )}
            </div>
          </>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-xs font-bold text-marinho tracking-wider uppercase">
              {t('senha')}
            </label>
            {mode === 'login' && (
              <Link href="/recuperar-senha" className="text-xs font-medium text-marinho hover:underline">
                {t('esqueceu')}
              </Link>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'cadastro' ? t('senhaPlaceholderCriar') : '••••••••'}
              minLength={mode === 'cadastro' ? 8 : undefined}
              required
              className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('ocultarSenha') : t('mostrarSenha')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {mode === 'cadastro' && <PasswordRequirements password={password} />}
        </div>

        {mode === 'cadastro' && (() => {
          // Confere a digitação: avisa a diferença ao terminar de digitar (ou ao tentar enviar).
          const iguais = confirmPassword.length > 0 && confirmPassword === password;
          const diferentes = confirmPassword.length > 0 && confirmPassword !== password
            && (attemptedSubmit || confirmPassword.length >= password.length);
          return (
            <div>
              <label htmlFor="confirm-password" className="block mb-2 text-xs font-bold text-marinho tracking-wider uppercase">
                {t('confirmarSenha')}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmarSenhaPlaceholder')}
                  autoComplete="new-password"
                  required
                  aria-invalid={diferentes}
                  aria-describedby="confirm-password-status"
                  className={`w-full pl-11 pr-12 py-3.5 rounded-xl border bg-slate-50/50 text-sm text-grafite placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20 focus:border-marinho transition-all ${
                    diferentes ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? t('ocultarSenha') : t('mostrarSenha')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p id="confirm-password-status" aria-live="polite">
                {iguais && (
                  <span className="mt-2 flex items-center gap-2 text-xs text-turquesa-escuro">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-turquesa/15"><Check className="h-3 w-3" /></span>
                    {t('senhasIguais')}
                  </span>
                )}
                {diferentes && (
                  <span className="mt-2 flex items-center gap-2 text-xs text-red-500">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-50 text-red-400"><X className="h-3 w-3" /></span>
                    {t('senhasDiferentes')}
                  </span>
                )}
              </p>
            </div>
          );
        })()}

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
              {mode === 'login' ? t('abaEntrar') : t('abaCriar')}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function EntrarPage() {
  const t = useTranslations('Auth');
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
            <EntrarForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          {t.rich('gestor', {
            link: (texto) => (
              <Link href="/painel/login?aba=entrar" className="text-marinho font-medium hover:underline">
                {texto}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}

// URL base do app: usa NEXT_PUBLIC_APP_URL (domínio de produção, ex.: https://www.boatzy.app)
// e cai para window.location.origin apenas em ambientes sem a env configurada.
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
}

/** Erro do Supabase Auth → chave da mensagem (`Auth.erros`). */
function translateError(message: string) {
  if (message.includes('Invalid login credentials')) return 'Auth.erros.credenciais' as const;
  if (message.includes('Email not confirmed')) return 'Auth.erros.naoConfirmado' as const;
  if (message.includes('User already registered') || message.includes('already been registered')) return 'Auth.erros.jaCadastrado' as const;
  if (message.includes('Password should be at least')) return 'Auth.erros.senhaCurta' as const;
  if (message.includes('Too many requests')) return 'Auth.erros.muitasTentativas' as const;
  if (message.includes('Unable to validate email')) return 'Auth.erros.emailInvalido' as const;
  return 'Auth.erros.generico' as const;
}
