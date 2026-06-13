'use client';

import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import SocialLoginButtons, { type OAuthProvider } from '@/components/auth/SocialLoginButtons';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export default function PainelLoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  async function handleSocial(provider: OAuthProvider) {
    setError('');

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${APP_URL}/painel/auth/callback` },
    });

    if (authError) {
      setError(translateError(authError.message));
      throw authError;
    }
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
          <div className="mb-6">
            <SocialLoginButtons onProvider={handleSocial} disabled={loading} />
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
              disabled={loading}
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
