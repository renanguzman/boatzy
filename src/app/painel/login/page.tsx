'use client';

import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

const socialProviders = [
  {
    id: 'google' as const,
    label: 'Google',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    id: 'facebook' as const,
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: 'apple' as const,
    label: 'Apple',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    ),
  },
] as const;

export default function PainelLoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(translateError(authError.message));
      setLoading(false);
      return;
    }

    // Redireciona para setup-role que garante o registro no DB com role gestor.
    window.location.href = '/api/painel/setup-role';
  }

  async function handleSocial(provider: 'google' | 'facebook' | 'apple') {
    setSocialLoading(provider);
    setError('');

    const callbackUrl = `${APP_URL}/painel/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
  }

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

          <h1 className="text-2xl font-bold text-[#0B2447] mb-1">Bem-vindo de volta</h1>
          <p className="text-slate-500 text-sm mb-8">Acesso seguro ao Portal de Gestão da Frota.</p>

          {/* Social login */}
          <div className="flex flex-col gap-3 mb-6">
            {socialProviders.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSocial(id)}
                disabled={!!socialLoading || loading}
                className="flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {socialLoading === id ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
                Continuar com {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Email + senha */}
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase">
                  Senha
                </label>
                <Link href="/painel/recuperar-senha" className="text-xs font-medium text-[#0B3D91] hover:text-[#0B2447] transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
              disabled={loading || !!socialLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#0B2447]/20 hover:shadow-[#0B3D91]/30"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Entrar no Painel
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Ainda não tem conta?{' '}
            <Link href="/painel/cadastro" className="text-[#0B3D91] font-medium hover:underline">
              Criar agora
            </Link>
          </p>
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

function translateError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (message.includes('Too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (message.includes('User not found')) return 'Usuário não encontrado.';
  return 'Erro ao autenticar. Tente novamente.';
}
