'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, User, Globe, LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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
                <div className="flex items-center gap-2.5">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      width={32}
                      height={32}
                      className="rounded-full w-8 h-8 object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#0B2447] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    title="Sair"
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
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
                <button
                  onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-500 w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
