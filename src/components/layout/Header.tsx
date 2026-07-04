'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, User, Globe, LogOut, Loader2, CalendarCheck, UserCog, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import type { User as SupabaseUser, RealtimeChannel } from '@supabase/supabase-js';
import UserMenu from './UserMenu';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Total de mensagens de chat não lidas (cliente), mantido ao vivo via Realtime.
  useEffect(() => {
    if (!user) return;
    let active = true;
    let channel: RealtimeChannel | undefined;
    async function refetch() {
      const { data } = await supabase.rpc('chat_total_nao_lidas_cliente');
      if (active) setNaoLidas(Number(data ?? 0));
    }
    (async () => {
      await authorizeRealtime(supabase);
      if (!active) return;
      await refetch();
      channel = supabase
        .channel('header:nao-lidas-cliente')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagem' }, () => {
          void refetch();
        })
        .subscribe();
    })();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  const entrarUrl = `/entrar?redirect_to=${encodeURIComponent(pathname)}`;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.email ?? '') as string;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" id="header-logo">
            <Image src="/images/logo.png" alt="Boatzy" width={180} height={54} className="h-14 w-auto" priority />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" id="main-nav">
            <Link href="/charters" className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors">
              Charters
            </Link>
            <Link href="/destinations" className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors">
              Destinos
            </Link>
            <Link href="/experiences" className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors">
              Experiências
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#0B3D91] transition-colors">
              <Globe className="h-4 w-4" />
              <span>PT</span>
            </button>

            {/* Auth */}
            <div className="hidden md:flex items-center">
              {authLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
              ) : user ? (
                <UserMenu
                  displayName={displayName}
                  email={(user.email ?? '') as string}
                  avatarUrl={avatarUrl}
                  naoLidas={naoLidas}
                  onSignOut={handleSignOut}
                />
              ) : (
                <Link
                  href={entrarUrl}
                  className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-[#0B3D91] hover:text-[#0B3D91] transition-all"
                  id="auth-button"
                >
                  <User className="h-4 w-4" />
                  <span>Entrar</span>
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-lg border border-slate-200 p-2"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-slate-700" /> : <Menu className="h-5 w-5 text-slate-700" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-4 animate-in slide-in-from-top">
            <nav className="flex flex-col gap-1">
              <Link href="/charters" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
                Charters
              </Link>
              <Link href="/destinations" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
                Destinos
              </Link>
              <Link href="/experiences" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
                Experiências
              </Link>
              <hr className="border-slate-100 my-1" />
              {!authLoading && !user && (
                <Link
                  href={entrarUrl}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#0B3D91]"
                >
                  <User className="h-4 w-4" />
                  Entrar
                </Link>
              )}
              {!authLoading && user && (
                <>
                  <Link
                    href="/minhas-reservas"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                  >
                    <CalendarCheck className="h-4 w-4 text-slate-400" />
                    Minhas reservas
                    {naoLidas > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {naoLidas > 99 ? '99+' : naoLidas}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/favoritos"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                  >
                    <Heart className="h-4 w-4 text-slate-400" />
                    Favoritos
                  </Link>
                  <Link
                    href="/minha-conta"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                  >
                    <UserCog className="h-4 w-4 text-slate-400" />
                    Minha conta
                  </Link>
                  <button
                    onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-500 w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
