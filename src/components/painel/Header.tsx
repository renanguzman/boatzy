'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import NotificacoesBell from './NotificacoesBell';
import { TutorialButton } from './TutorialPainel';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'Overview' }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.email ?? 'Usuário') as string;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[#0B2447]">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <NotificacoesBell />

        <TutorialButton />

        <div className="pl-2 border-l border-slate-200 flex items-center">
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
