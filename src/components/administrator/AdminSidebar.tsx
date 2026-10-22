'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  Star,
  Ship,
  MapPin,
  TicketPercent,
  Megaphone,
  Percent,
  Tags,
  FileText,
  Settings,
  Wallet,
  Receipt,
  LogOut,
  LayoutList,
  BadgeDollarSign,
  Users,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { href: '/administrator', label: 'DASHBOARD', icon: LayoutDashboard, exact: true },
  { href: '/administrator/usuarios', label: 'USUÁRIOS', icon: Users, exact: false },
  { href: '/administrator/avaliacoes', label: 'AVALIAÇÕES', icon: Star, exact: false },
  { href: '/administrator/embarcacoes', label: 'EMBARCAÇÕES', icon: Ship, exact: false },
  { href: '/administrator/roteiros', label: 'ROTEIROS', icon: MapPin, exact: false },
  { href: '/administrator/vendas', label: 'ANÚNCIOS DE VENDA', icon: BadgeDollarSign, exact: false },
  { href: '/administrator/cupons', label: 'CUPONS', icon: TicketPercent, exact: false },
  { href: '/administrator/publicidade', label: 'PUBLICIDADE', icon: Megaphone, exact: false },
  { href: '/administrator/taxas', label: 'TAXAS', icon: Percent, exact: false },
  { href: '/administrator/pedidos', label: 'PEDIDOS', icon: Receipt, exact: false },
  { href: '/administrator/financeiro', label: 'FINANCEIRO', icon: Wallet, exact: false },
  { href: '/administrator/tipos', label: 'TIPOS', icon: Tags, exact: false },
  { href: '/administrator/cadastros-auxiliares', label: 'CADASTROS AUXILIARES', icon: LayoutList, exact: false },
  { href: '/administrator/termos', label: 'TERMOS DE USO', icon: FileText, exact: false },
  { href: '/administrator/configuracoes', label: 'CONFIGURAÇÕES', icon: Settings, exact: false },
];

type FilaAnalise = 'embarcacao' | 'roteiro' | 'anuncio_venda' | 'solicitacao_gestor';

/** Itens com fila de análise (pipeline de aprovação e pedidos de gestor) — contador ao lado do rótulo. */
const PENDENTES_POR_HREF: Record<string, FilaAnalise> = {
  '/administrator/usuarios': 'solicitacao_gestor',
  '/administrator/embarcacoes': 'embarcacao',
  '/administrator/roteiros': 'roteiro',
  '/administrator/vendas': 'anuncio_venda',
};

export default function AdminSidebar({ pendentes }: {
  /** Registros Em análise por entidade (pipeline de aprovação) e pedidos de gestor pendentes. */
  pendentes?: Record<FilaAnalise, number>;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/administrator/login');
  }

  return (
    <aside className="w-[260px] h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="px-6 py-6">
        <Link href="/administrator" className="block">
          <Image src="/images/logo.png" alt="Boatzy" width={180} height={54} className="h-12 w-auto mb-1" priority />
          <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase ml-1 block">
            Administração Geral
          </span>
        </Link>
      </div>

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
                  : 'text-slate-500 hover:bg-slate-50 hover:text-[#0B2447]',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {(() => {
                const n = PENDENTES_POR_HREF[href] ? pendentes?.[PENDENTES_POR_HREF[href]] ?? 0 : 0;
                return n > 0 ? (
                  <span
                    title={`${n} aguardando análise`}
                    className={clsx(
                      'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold',
                      active ? 'bg-white text-[#0B2447]' : 'bg-amber-500 text-white',
                    )}
                  >
                    {n}
                  </span>
                ) : null;
              })()}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-6 space-y-0.5">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-xs font-semibold tracking-wide text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          SAIR
        </button>
      </div>
    </aside>
  );
}
