'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarCheck, UserCog, LogOut, ChevronDown, Heart, MessageCircle } from 'lucide-react';

type Props = {
  displayName: string;
  email: string;
  avatarUrl?: string;
  naoLidas?: number;
  onSignOut: () => void;
};

export default function UserMenu({ displayName, email, avatarUrl, naoLidas = 0, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const inicial = (displayName || email || '?').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex items-center gap-1.5 rounded-full border border-slate-200 p-0.5 pr-2 hover:border-[#0B3D91]/40 hover:shadow-sm transition-all"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={32}
            height={32}
            className="rounded-full w-8 h-8 object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#0B2447] flex items-center justify-center">
            <span className="text-white text-xs font-bold">{inicial}</span>
          </div>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        {naoLidas > 0 && (
          <span
            className="absolute -top-0.5 -left-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ring-2 ring-white"
            title={`${naoLidas} mensagem(ns) não lida(s)`}
          >
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/5 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1"
        >
          {/* Cabeçalho do usuário */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-[#0B2447] truncate">{displayName || 'Minha conta'}</p>
            {email && <p className="text-xs text-slate-400 truncate">{email}</p>}
          </div>

          <nav className="py-1.5">
            <Link
              href="/minhas-conversas"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#0B3D91] transition-colors"
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
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#0B3D91] transition-colors"
            >
              <CalendarCheck className="h-4 w-4 text-slate-400" />
              Minhas reservas
            </Link>
            <Link
              href="/favoritos"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#0B3D91] transition-colors"
            >
              <Heart className="h-4 w-4 text-slate-400" />
              Favoritos
            </Link>
            <Link
              href="/minha-conta"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#0B3D91] transition-colors"
            >
              <UserCog className="h-4 w-4 text-slate-400" />
              Minha conta
            </Link>
          </nav>

          <div className="border-t border-slate-100 py-1.5">
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
