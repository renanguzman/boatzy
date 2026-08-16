'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { User, Briefcase, ChevronDown } from 'lucide-react';

type Props = {
  /** `/entrar` já com `?redirect_to=...` calculado pelo Header. */
  entrarClienteUrl: string;
};

/** Botão "Entrar" (desktop) que abre um menu com as duas portas de acesso: cliente x proprietário. */
export default function EntrarMenu({ entrarClienteUrl }: Props) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        id="auth-button"
        className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-[#0B3D91] hover:text-[#0B3D91] transition-all"
      >
        <User className="h-4 w-4" />
        <span>Entrar</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/5 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-[#0B2447]">Como você quer entrar?</p>
          </div>

          <nav className="py-1.5">
            <Link
              href={entrarClienteUrl}
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#0B3D91] transition-colors"
            >
              <span className="h-9 w-9 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-[#0B3D91]" />
              </span>
              <span>
                <span className="block font-medium">Entrar como Cliente</span>
                <span className="block text-xs text-slate-400">Alugar embarcações e roteiros</span>
              </span>
            </Link>
            <Link
              href="/painel"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#0B3D91] transition-colors"
            >
              <span className="h-9 w-9 rounded-xl bg-[#0B3D91]/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4 text-[#0B3D91]" />
              </span>
              <span>
                <span className="block font-medium">Entrar como Proprietário</span>
                <span className="block text-xs text-slate-400">Anunciar e gerenciar embarcações</span>
              </span>
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
