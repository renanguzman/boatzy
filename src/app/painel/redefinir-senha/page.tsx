'use client';

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

type Status = 'checking' | 'no-session' | 'form' | 'success';

function PainelRedefinirSenhaForm() {
  const supabase = createClient();

  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // A sessão é criada pelo /auth/confirm ao validar o link do e-mail.
  // Sem ela o updateUser falharia — mostramos direto o estado de link inválido.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? 'form' : 'no-session');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      if (isSessionError(authError)) {
        setStatus('no-session');
      } else {
        setError(translateError(authError));
      }
      setLoading(false);
      return;
    }

    setStatus('success');
    setLoading(false);
  }

  if (status === 'checking') {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (status === 'no-session') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <TriangleAlert className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2447] mb-2">Link inválido ou expirado</h2>
        <p className="text-slate-500 text-sm mb-6">
          O link de redefinição não é mais válido. Solicite um novo para continuar.
        </p>
        <Link
          href="/painel/recuperar-senha"
          className="w-full flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-[#0B2447]/20"
        >
          Solicitar novo link
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-[#0B2447] mb-2">Senha redefinida!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Sua senha foi alterada com sucesso. Você já está conectado.
        </p>
        {/* setup-role garante a role `gestor` (idempotente) antes de entrar no painel —
            mesmo caminho usado após login e cadastro do gestor. */}
        <a
          href="/api/painel/setup-role"
          className="w-full flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-[#0B2447]/20"
        >
          Entrar no Painel
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold text-[#0B2447] mb-2">Redefinir senha</h1>
      <p className="text-slate-500 text-sm mb-6">
        Escolha uma nova senha para a sua conta.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase mb-2">
            Nova senha
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
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

        <div>
          <label htmlFor="confirm" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase mb-2">
            Confirmar nova senha
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              minLength={6}
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
          className="w-full flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#0B2447]/20"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Redefinir senha
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function PainelRedefinirSenhaPage() {
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

          <PainelRedefinirSenhaForm />
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

function isSessionError(error: { code?: string; message: string }): boolean {
  return (
    error.code === 'session_expired' ||
    error.code === 'session_not_found' ||
    error.message.toLowerCase().includes('session')
  );
}

function translateError(error: { code?: string; message: string }): string {
  if (
    error.code === 'same_password' ||
    error.message.includes('different from the old password') ||
    error.message.includes('New password should be different')
  ) {
    return 'A nova senha deve ser diferente da senha atual.';
  }
  if (error.code === 'weak_password' || error.message.includes('Password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (error.code === 'over_request_rate_limit' || error.message.includes('Too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos.';
  }
  return 'Não foi possível redefinir a senha. Tente novamente.';
}
