'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Ship,
  CalendarDays,
  DollarSign,
  Users,
  MapPin,
  Plus,
  LogOut,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { href: '/painel', label: 'DASHBOARD', icon: LayoutDashboard, exact: true },
  { href: '/painel/agendamentos', label: 'AGENDAMENTOS', icon: CalendarDays, exact: false },
  { href: '/painel/embarcacoes', label: 'EMBARCAÇÕES', icon: Ship, exact: false },
  { href: '/painel/roteiros', label: 'ROTEIROS', icon: MapPin, exact: false },
  { href: '/painel/catalogo', label: 'CATÁLOGO', icon: BookOpen, exact: false },
  { href: '/painel/clientes', label: 'CLIENTES', icon: Users, exact: false },
  { href: '/painel/receitas', label: 'RECEITAS', icon: DollarSign, exact: false },
];

export default function Sidebar({ naoLidas = 0 }: { naoLidas?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabaseRef = useRef(createClient());

  // Total de mensagens não lidas: começa com o valor do servidor e é mantido
  // ao vivo via Realtime (eventos em `mensagem`).
  const [totalNaoLidas, setTotalNaoLidas] = useState(naoLidas);

  useEffect(() => {
    const supabase = supabaseRef.current;

    async function refetch() {
      const { data } = await supabase.rpc('chat_total_nao_lidas');
      setTotalNaoLidas(Number(data ?? 0));
    }

    // Qualquer mudança em `mensagem` que a RLS entregue (conversas deste gestor)
    // dispara um refetch do total.
    const channel = supabase
      .channel('sidebar:nao-lidas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagem' }, () => {
        void refetch();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function handleSignOut() {
    await supabaseRef.current.auth.signOut();
    router.push('/painel/login');
  }

  return (
    <aside className="w-[260px] h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="px-6 py-6">
        <Link href="/painel" className="block">
          <Image src="/images/logo.png" alt="Boatzy" width={180} height={54} className="h-12 w-auto mb-1" priority />
          <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase ml-1 block">
            Admin Portal
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const showBadge = href === '/painel/clientes' && totalNaoLidas > 0;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150',
                active
                  ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-[#0B2447]',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4">
          <Link
            href="/painel/embarcacoes/novo"
            className="flex items-center justify-center gap-2 w-full bg-[#0B3D91] hover:bg-[#0B2447] text-white font-semibold text-xs py-3 rounded-xl transition-all duration-200 shadow-lg shadow-[#0B3D91]/20"
          >
            <Plus className="w-4 h-4" />
            Nova Embarcação
          </Link>
        </div>
      </nav>

      <div className="px-4 pb-6 space-y-0.5">
        <Link
          href="/painel/suporte"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-slate-500 hover:bg-slate-50 hover:text-[#0B2447] transition-all duration-150"
        >
          <HelpCircle className="w-4 h-4" />
          SUPPORT
        </Link>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-xs font-semibold tracking-wide text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          SIGN OUT
        </button>
      </div>
    </aside>
  );
}
