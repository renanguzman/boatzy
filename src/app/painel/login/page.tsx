'use client';

import { useClerk } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ship, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function PainelLoginPage() {
  const clerk = useClerk();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSigned, setKeepSigned] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded) return;

    setLoading(true);
    setError('');

    try {
      const result = await clerk.client.signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        router.push('/painel');
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message?: string; longMessage?: string }> };
      setError(
        clerkError.errors?.[0]?.longMessage ??
        clerkError.errors?.[0]?.message ??
        'Credenciais inválidas. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side — Hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="/images/lancha_bg_painel.png"
          alt="Luxury yacht at sunset"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/80 via-[#0B2447]/30 to-transparent" />

        {/* Bottom text */}
        <div className="absolute bottom-12 left-10 right-10 z-10">
          <p className="text-white/90 font-semibold text-lg italic mb-2">
            Precision in every knot.
          </p>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Managing the world&apos;s most exclusive maritime charters with the Boatzy administrative suite.
          </p>
          <p className="mt-6 text-xs font-bold tracking-[0.3em] text-cyan-400/80 uppercase">
            Maritime Excellence
          </p>
        </div>
      </div>

      {/* Right side — Login form */}
      <div className="flex-1 flex flex-col justify-between px-8 py-10 lg:px-16 xl:px-24">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          {/* Branding */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 bg-[#0B2447] rounded-lg flex items-center justify-center">
              <Ship className="w-5 h-5 text-white" />
            </div>
            <span className="text-[#0B2447] font-bold text-lg tracking-tight">
              Boatzy Admin
            </span>
          </div>

          {/* Welcome */}
          <h1 className="text-2xl font-bold text-[#0B2447] mb-1">Welcome Back</h1>
          <p className="text-slate-500 text-sm mb-8">
            Secure access to the Fleet Management Portal.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase mb-2">
                Email Address
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-bold text-[#0B2447] tracking-wider uppercase">
                  Password
                </label>
                <button type="button" className="text-xs font-medium text-[#0B3D91] hover:text-[#0B2447] transition-colors">
                  Forgot password?
                </button>
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

            {/* Keep signed in */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={keepSigned}
                  onChange={(e) => setKeepSigned(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-4 h-4 rounded border border-slate-300 bg-white peer-checked:bg-[#0B3D91] peer-checked:border-[#0B3D91] transition-all flex items-center justify-center">
                  {keepSigned && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-slate-600">Keep me signed in</span>
            </label>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#0B2447] hover:bg-[#0B3D91] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#0B2447]/20 hover:shadow-[#0B3D91]/30"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/painel/cadastro" className="text-[#0B3D91] font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-8 border-t border-slate-100 mt-8">
          <p>© {new Date().getFullYear()} BOATZY MARITIME SYSTEMS</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-600 cursor-pointer transition-colors">PRIVACY</span>
            <span className="hover:text-slate-600 cursor-pointer transition-colors">SECURITY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
