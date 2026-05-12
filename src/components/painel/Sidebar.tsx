'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Ship,
  CalendarDays,
  DollarSign,
  Users,
  Wrench,
  Plus,
  LogOut,
  HelpCircle,
  Anchor,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { href: '/painel', label: 'DASHBOARD', icon: LayoutDashboard, exact: true },
  { href: '/painel/embarcacoes', label: 'FLEET MANAGEMENT', icon: Ship, exact: false },
  { href: '/painel/agendamentos', label: 'BOOKINGS', icon: CalendarDays, exact: false },
  { href: '/painel/receitas', label: 'REVENUE', icon: DollarSign, exact: false },
  { href: '/painel/clientes', label: 'CUSTOMER INSIGHTS', icon: Users, exact: false },
  { href: '/painel/manutencao', label: 'MAINTENANCE', icon: Wrench, exact: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <aside className="w-[260px] h-full bg-white border-r border-slate-200 flex flex-col">
      {/* Logo / Branding */}
      <div className="px-6 py-6">
        <Link href="/painel" className="block">
          <Image
            src="/images/logo.png"
            alt="Boatzy"
            width={180}
            height={54}
            className="h-12 w-auto mb-1"
            priority
          />
          <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase ml-1 block">
            Admin Portal
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150',
                active
                  ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-[#0B2447]'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Add New Vessel Button */}
        <div className="pt-4">
          <Link
            href="/painel/embarcacoes/novo"
            className="flex items-center justify-center gap-2 w-full bg-[#0B3D91] hover:bg-[#0B2447] text-white font-semibold text-xs py-3 rounded-xl transition-all duration-200 shadow-lg shadow-[#0B3D91]/20"
          >
            <Plus className="w-4 h-4" />
            Add New Vessel
          </Link>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-4 pb-6 space-y-0.5">
        <Link
          href="/painel/suporte"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide text-slate-500 hover:bg-slate-50 hover:text-[#0B2447] transition-all duration-150"
        >
          <HelpCircle className="w-4 h-4" />
          SUPPORT
        </Link>

        <button 
          onClick={() => signOut({ redirectUrl: '/painel/login' })}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-xs font-semibold tracking-wide text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          SIGN OUT
        </button>
      </div>
    </aside>
  );
}
