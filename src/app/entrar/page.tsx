'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import SocialLoginButtons, { type OAuthProvider } from '@/components/auth/SocialLoginButtons';

function EntrarForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // `redirect_to` preserva a página de origem (ex: /charters/xyz)
  const redirectTo = searchParams.get('redirect_to') ?? '/';

  const [mode, setMode] = useState<'login' | 'cadastro'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    setPassword('');
    setSuccess(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(translateError(authError.message));
      setLoading(false);
      return;
    }

    // setup-cliente garante o registro no DB com role cliente e redireciona de volta
    const setupUrl = `/api/auth/setup-cliente?redirect_to=${encodeURIComponent(redirectTo)}`;
    window.location.href = setupUrl;
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/api/auth/setup-cliente?redirect_to=${encodeURIComponent(redirectTo)}`
        )}`,
      },
    });

    if (authError) {
      setError(translateError(authError.message));
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
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (authError) {
      setError(translateError(authError.message));
      throw authError; // sinaliza falha ao SocialLoginButtons para limpar o loading
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2447] mb-2">Verifique seu e-mail</h2>
        <p className="text-slate-500 text-sm mb-6">
          Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para ativar sua conta.
        </p>
        <button
          onClick={() => { setMode('login'); resetForm(); }}
          className="text-[#0B3D91] text-sm font-medium hover:underline"
        >
          Já confirmei — fazer login
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
              ? 'bg-[#0B2447] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Entrar
        </button>
        <button
          onClick={() => { setMode('cadastro'); resetForm(); }}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            mode === 'cadastro'
              ? 'bg-[#0B2447] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Criar conta
        </button>
      </div>

      {/* Login social */}
      <div className="mb-6">
        <SocialLoginButtons onProvider={handleSocial} disabled={loading} />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">
          {mode === 'login' ? 'ou entre com e-mail' : 'ou crie com e-mail'}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <form onSubmit={mode === 'login' ? handleLogin : handleCadastro} className="space-y-4">
        {mode === 'cadastro' && (
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase mb-2">
              Nome completo
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                required
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all"
              />
            </div>
          </div>
        )}

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
              placeholder="joao@exemplo.com"
              required
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase">
              Senha
            </label>
            {mode === 'login' && (
              <Link href="/recuperar-senha" className="text-xs font-medium text-[#0B3D91] hover:underline">
                Esqueceu a senha?
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
              placeholder={mode === 'cadastro' ? 'Mínimo 6 caracteres' : '••••••••'}
              minLength={mode === 'cadastro' ? 6 : undefined}
              required
              className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
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
          className="w-full flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#0B2447]/20"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function EntrarPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <Image
              src="/images/logo.png"
              alt="Boatzy"
              width={160}
              height={48}
              className="h-12 w-auto mx-auto"
            />
          </Link>
          <p className="text-slate-500 text-sm mt-3">
            Acesse sua conta para reservar embarcações
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
            <EntrarForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          É gestor de embarcações?{' '}
          <Link href="/painel/login" className="text-[#0B3D91] font-medium hover:underline">
            Acesse o Painel
          </Link>
        </p>
      </div>
    </div>
  );
}

function translateError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (message.includes('User already registered') || message.includes('already been registered')) return 'Este e-mail já possui uma conta.';
  if (message.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (message.includes('Too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (message.includes('Unable to validate email')) return 'E-mail inválido.';
  return 'Erro ao autenticar. Tente novamente.';
}
