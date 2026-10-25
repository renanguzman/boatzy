'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import NotificacoesBell from './NotificacoesBell';
import { TutorialButton } from './TutorialPainel';
import { useMenuMobile } from './MenuMobile';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'Overview' }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();
  const { aberto, abrir } = useMenuMobile();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.email ?? 'Usuário') as string;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-14 lg:h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={abrir}
          aria-label="Abrir menu"
          aria-controls="painel-menu"
          aria-expanded={aberto}
          className="lg:hidden p-2.5 -ml-1 rounded-xl text-[#0B2447] hover:bg-slate-50 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/painel" className="lg:hidden shrink-0" aria-label="Boatzy — Dashboard">
          <Image src="/images/logo.png" alt="Boatzy" width={120} height={36} className="h-8 w-auto" />
        </Link>
        <h2 className="hidden lg:block text-sm font-semibold text-[#0B2447] truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-1 sm:gap-4">
        <NotificacoesBell userId={user?.id ?? null} />

        <TutorialButton />

        <div className="pl-2 ml-1 sm:ml-0 border-l border-slate-200 flex items-center">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={36}
              height={36}
              className="rounded-full w-9 h-9 object-cover border-2 border-slate-100"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#0B2447] flex items-center justify-center border-2 border-slate-100">
              <span className="text-white text-sm font-bold">{initial}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
