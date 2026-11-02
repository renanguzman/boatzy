'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { authorizeRealtime } from '@/lib/supabase/realtime';
import {
  House,
  Ship,
  CalendarDays,
  DollarSign,
  Users,
  MapPin,
  Plus,
  LogOut,
  HelpCircle,
  BookOpen,
  Tag,
  UsersRound,
  UserRound,
  FileCheck2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useMenuMobile } from './MenuMobile';
import { EVENTO_AVISO_GESTOR } from './NotificacoesBell';

type ItemMenu = { href: string; label: string; icon: typeof House; exact: boolean; tour: string };

/**
 * Menu agrupado por frequência de uso (SPEC §97): o dia a dia no topo, os cadastros
 * na ordem da jornada (embarcação → documentos → roteiro) e as demais ferramentas no fim.
 */
const GRUPOS_MENU: { titulo: string | null; tour?: string; itens: ItemMenu[] }[] = [
  {
    titulo: null,
    itens: [
      { href: '/painel', label: 'INÍCIO', icon: House, exact: true, tour: 'nav-dashboard' },
      { href: '/painel/agendamentos', label: 'RESERVAS', icon: CalendarDays, exact: false, tour: 'nav-agendamentos' },
      { href: '/painel/clientes', label: 'CLIENTES', icon: Users, exact: false, tour: 'nav-clientes' },
    ],
  },
  {
    titulo: 'Seus cadastros',
    tour: 'nav-grupo-cadastros',
    itens: [
      { href: '/painel/embarcacoes', label: 'EMBARCAÇÕES', icon: Ship, exact: false, tour: 'nav-embarcacoes' },
      { href: '/painel/documentos', label: 'DOCUMENTOS', icon: FileCheck2, exact: false, tour: 'nav-documentos' },
      { href: '/painel/roteiros', label: 'ROTEIROS E PREÇOS', icon: MapPin, exact: false, tour: 'nav-roteiros' },
      { href: '/painel/perfil', label: 'MEU PERFIL', icon: UserRound, exact: false, tour: 'nav-perfil' },
    ],
  },
  {
    titulo: 'Mais ferramentas',
    tour: 'nav-grupo-ferramentas',
    itens: [
      { href: '/painel/catalogo', label: 'CATÁLOGO DE EXTRAS', icon: BookOpen, exact: false, tour: 'nav-catalogo' },
      { href: '/painel/equipe', label: 'EQUIPE', icon: UsersRound, exact: false, tour: 'nav-equipe' },
      { href: '/painel/receitas', label: 'RECEITAS', icon: DollarSign, exact: false, tour: 'nav-receitas' },
      { href: '/painel/vendas', label: 'VENDA DE EMBARCAÇÕES', icon: Tag, exact: false, tour: 'nav-vendas' },
    ],
  },
];

export default function Sidebar({
  naoLidas = 0,
  pendentes = 0,
  userId = null,
  documentos = { alerta: 0, vencidos: 0 },
  perfilPendente = false,
}: {
  naoLidas?: number;
  /** Documentos vencidos ou vencendo em até 60 dias (badge de DOCUMENTOS — SPEC §95.6). */
  documentos?: { alerta: number; vencidos: number };
  /** Solicitações de reserva aguardando resposta do gestor (badge de AGENDAMENTOS). */
  pendentes?: number;
  userId?: string | null;
  /** Perfil de operador por preencher ou devolvido pela equipe: pontinho em MEU PERFIL (SPEC §99). */
  perfilPendente?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const { aberto, fechar } = useMenuMobile();

  // Total de mensagens não lidas: começa com o valor do servidor e é mantido
  // ao vivo via Realtime (eventos em `mensagem`).
  const [totalNaoLidas, setTotalNaoLidas] = useState(naoLidas);

  // Solicitações pendentes: valor do servidor, recontado a cada navegação (o gestor pode ter
  // acabado de responder uma) e quando chega aviso novo ao gestor pelo sino (Realtime).
  const [totalPendentes, setTotalPendentes] = useState(pendentes);

  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    async function recontar() {
      const { count, error } = await supabaseRef.current
        .from('reserva')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId!)
        .eq('status', 'pendente');
      if (!cancelado && !error) setTotalPendentes(count ?? 0);
    }
    void recontar();
    window.addEventListener(EVENTO_AVISO_GESTOR, recontar);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_AVISO_GESTOR, recontar);
    };
  }, [userId, pathname]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    async function refetch() {
      const { data } = await supabase.rpc('chat_total_nao_lidas');
      if (!cancelled) setTotalNaoLidas(Number(data ?? 0));
    }

    (async () => {
      await authorizeRealtime(supabase);
      if (cancelled) return;
      // Valor autoritativo do client (sessão autenticada) + assinatura ao vivo.
      await refetch();
      // Qualquer mudança em `mensagem` que a RLS entregue (conversas deste gestor)
      // dispara um refetch do total.
      channel = supabase
        .channel('sidebar:nao-lidas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagem' }, () => {
          void refetch();
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function handleSignOut() {
    await supabaseRef.current.auth.signOut();
    router.push('/painel/login');
  }

  return (
    <>
      {/* Fundo escurecido do drawer (só < lg). */}
      <div
        aria-hidden="true"
        onClick={fechar}
        className={clsx(
          'fixed inset-0 z-40 bg-[#0B2447]/50 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          aberto ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Desktop: coluna fixa. Mobile/tablet: drawer deslizante pela esquerda. */}
      <aside
        id="painel-menu"
        aria-label="Menu do painel"
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] h-dvh bg-white border-r border-slate-200 flex flex-col',
          'transition-[transform,visibility] duration-300 ease-out',
          'lg:static lg:z-auto lg:shrink-0 lg:w-[260px] lg:max-w-none lg:h-full lg:translate-x-0 lg:visible lg:shadow-none',
          aberto ? 'translate-x-0 visible shadow-2xl' : '-translate-x-full invisible',
        )}
      >
        <div className="px-6 py-5 lg:py-6 flex items-start justify-between gap-3">
          <Link href="/painel" className="block">
            <Image src="/images/logo-horizontal-header-site.svg" alt="Boatzy" width={459} height={130} className="h-9 lg:h-10 w-auto mb-1.5" priority />
            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase ml-1 block">
              Painel do proprietário
            </span>
          </Link>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar menu"
            className="lg:hidden -mr-2 p-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-[#0B2447] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-2">
          {GRUPOS_MENU.map((grupo) => (
          <div key={grupo.titulo ?? 'principal'} data-tour={grupo.tour} className={clsx('space-y-0.5', grupo.titulo && 'mt-4')}>
          {grupo.titulo && (
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{grupo.titulo}</p>
          )}
          {grupo.itens.map(({ href, label, icon: Icon, exact, tour }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            // Clientes: mensagens não lidas. Agendamentos: solicitações aguardando resposta.
            // Documentos: vencidos (vermelho) ou só vencendo em breve (âmbar).
            const badge = href === '/painel/clientes' ? totalNaoLidas
              : href === '/painel/agendamentos' ? totalPendentes
              : href === '/painel/documentos' ? documentos.alerta
              : 0;
            const tituloBadge = href === '/painel/agendamentos'
              ? `${badge} solicitaç${badge === 1 ? 'ão' : 'ões'} aguardando resposta`
              : href === '/painel/documentos'
                ? `${badge} documento${badge === 1 ? '' : 's'} vencido${badge === 1 ? '' : 's'} ou vencendo`
                : `${badge} mensage${badge === 1 ? 'm' : 'ns'} não lida${badge === 1 ? '' : 's'}`;
            const corBadge = href === '/painel/documentos' && documentos.vencidos === 0 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <Link
                key={href}
                href={href}
                data-tour={tour}
                className={clsx(
                  'flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150',
                  active
                    ? 'bg-[#0B2447] text-white shadow-md shadow-[#0B2447]/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-[#0B2447]',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {href === '/painel/perfil' && perfilPendente && (
                  <span
                    title="Complete o seu perfil"
                    role="img"
                    aria-label="Complete o seu perfil"
                    className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                  />
                )}
                {badge > 0 && (
                  <span
                    title={tituloBadge}
                    aria-label={tituloBadge}
                    className={clsx('min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-white text-[10px] font-bold leading-none', corBadge)}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
          </div>
          ))}

          <div className="pt-4">
            <Link
              href="/painel/embarcacoes/novo"
              data-tour="nova-embarcacao"
              className="flex items-center justify-center gap-2 w-full bg-[#0B3D91] hover:bg-[#0B2447] text-white font-semibold text-xs py-3 rounded-xl transition-all duration-200 shadow-lg shadow-[#0B3D91]/20"
            >
              <Plus className="w-4 h-4" />
              Nova Embarcação
            </Link>
          </div>
        </nav>

        <div className="px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-0.5 border-t border-slate-100 lg:border-0">
          <Link
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-xs font-semibold tracking-wide text-slate-500 hover:bg-slate-50 hover:text-[#0B2447] transition-all duration-150"
          >
            <HelpCircle className="w-4 h-4" />
            AJUDA
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-3 lg:py-2.5 w-full rounded-lg text-xs font-semibold tracking-wide text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            SAIR
          </button>
        </div>
      </aside>
    </>
  );
}
