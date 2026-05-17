'use client';

import { useEffect, useState } from 'react';
import { Bell, Settings, Search } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

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
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar frota ou reservas..."
            className="pl-9 pr-4 py-2 w-64 rounded-lg border border-slate-200 bg-slate-50/50 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all"
          />
        </div>

        <button className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <button className="p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]">
          <Settings className="w-5 h-5" />
        </button>

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
