'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, User, Briefcase, LogOut, Loader2, CalendarCheck, UserCog, Heart, MessageCircle, Megaphone, Tag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import type { User as SupabaseUser, RealtimeChannel } from '@supabase/supabase-js';
import UserMenu from './UserMenu';
import EntrarMenu from './EntrarMenu';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const [isGestor, setIsGestor] = useState(false);
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

  // Se o usuário logado também tem o perfil de gestor (dono de embarcação) — troca o
  // rótulo do CTA "Anuncie sua embarcação" por "Minhas embarcações". RLS permite ao
  // próprio usuário ler suas linhas em `user_roles` (policy `user_read_own_roles`).
  useEffect(() => {
    if (!user) {
      setIsGestor(false);
      return;
    }
    let active = true;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'gestor')
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsGestor(!!data);
      });
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
            <Image src="/images/logo-vertical.svg" alt="Boatzy" width={282} height={290} className="h-14 w-auto object-contain" priority />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" id="main-nav">
            <Link href="/buscar" className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors">
              Roteiros
            </Link>
            <Link href="/buscar?tipo=embarcacao" className="text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors">
              Embarcações
            </Link>
            <Link href="/vendas" className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-[#0B3D91] transition-colors">
              Vendas
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#0B3D91] to-cyan-400 text-white">
                <Tag className="h-2.5 w-2.5" />
              </span>
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/painel"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[#0B3D91]/10 px-4 py-2 text-sm font-semibold text-[#0B3D91] hover:bg-[#0B3D91] hover:text-white transition-colors"
            >
              <Megaphone className="h-4 w-4" />
              {isGestor ? 'Minhas embarcações' : 'Anuncie sua embarcação'}
            </Link>

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
                <EntrarMenu entrarClienteUrl={entrarUrl} />
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
              <Link href="/buscar" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
                Roteiros
              </Link>
              <Link href="/buscar?tipo=embarcacao" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
                Embarcações
              </Link>
              <Link href="/vendas" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
                Vendas
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#0B3D91] to-cyan-400 text-white">
                  <Tag className="h-2.5 w-2.5" />
                </span>
              </Link>
              <Link
                href="/painel"
                onClick={() => setMobileMenuOpen(false)}
                className="mx-3 mt-2 flex items-center justify-center gap-1.5 rounded-full bg-[#0B3D91]/10 px-4 py-2.5 text-sm font-semibold text-[#0B3D91]"
              >
                <Megaphone className="h-4 w-4" />
                {isGestor ? 'Minhas embarcações' : 'Anuncie sua embarcação'}
              </Link>
              <hr className="border-slate-100 my-1" />
              {!authLoading && !user && (
                <div className="px-3 py-1 space-y-2">
                  <p className="px-0 pb-1 text-xs font-bold text-slate-400 tracking-wider uppercase">
                    Como você quer entrar?
                  </p>
                  <Link
                    href={entrarUrl}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl bg-[#0B3D91] px-4 py-3 text-sm font-semibold text-white"
                  >
                    <User className="h-4 w-4" />
                    Entrar como Cliente
                  </Link>
                  <Link
                    href="/painel"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-[#0B2447]"
                  >
                    <Briefcase className="h-4 w-4" />
                    Entrar como Proprietário
                  </Link>
                </div>
              )}
              {!authLoading && user && (
                <>
                  <Link
                    href="/minhas-conversas"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                  >
                    <MessageCircle className="h-4 w-4 text-slate-400" />
                    Minhas conversas
                    {naoLidas > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {naoLidas > 99 ? '99+' : naoLidas}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/minhas-reservas"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                  >
                    <CalendarCheck className="h-4 w-4 text-slate-400" />
                    Minhas reservas
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
