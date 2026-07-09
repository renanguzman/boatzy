import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Ship,
  MapPin,
  CalendarDays,
  Star,
  Percent,
  Megaphone,
  Tags,
  Settings,
  ChevronRight,
  UserCog,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export default async function AdministratorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/administrator/login');

  // Métricas globais do sistema — contagens via service role (sem filtro de dono).
  const [
    { count: totalUsuarios },
    { count: totalGestores },
    { count: totalEmbarcacoes },
    { count: totalRoteiros },
    { count: totalReservas },
    { count: reservasPendentes },
    { count: totalAvaliacoes },
    { data: taxa },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'gestor'),
    supabaseAdmin.from('embarcacao').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('roteiro').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('reserva').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('reserva').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabaseAdmin.from('avaliacao').select('id', { count: 'exact', head: true }).eq('status', 'aprovada'),
    supabaseAdmin.from('taxa_plataforma').select('taxa_percent').eq('singleton', true).maybeSingle(),
  ]);

  const taxaPercent = taxa?.taxa_percent != null ? Number(taxa.taxa_percent) : null;

  const stats = [
    {
      label: 'Usuários',
      value: String(totalUsuarios ?? 0),
      sub: `${totalGestores ?? 0} gestor${(totalGestores ?? 0) !== 1 ? 'es' : ''}`,
      icon: Users,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: 'Embarcações',
      value: String(totalEmbarcacoes ?? 0),
      sub: 'em toda a plataforma',
      icon: Ship,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Roteiros',
      value: String(totalRoteiros ?? 0),
      sub: 'em toda a plataforma',
      icon: MapPin,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Reservas',
      value: String(totalReservas ?? 0),
      sub: `${reservasPendentes ?? 0} pendente${(reservasPendentes ?? 0) !== 1 ? 's' : ''}`,
      icon: CalendarDays,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Avaliações',
      value: String(totalAvaliacoes ?? 0),
      sub: 'publicadas por clientes',
      icon: Star,
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
    },
    {
      label: 'Taxa da plataforma',
      value: taxaPercent != null ? `${taxaPercent.toFixed(2).replace('.', ',')}%` : '—',
      sub: 'taxa geral vigente',
      icon: Percent,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
  ];

  const modulos = [
    {
      href: '/administrator/avaliacoes',
      titulo: 'Avaliações',
      descricao: 'Modere e exclua avaliações de qualquer roteiro ou embarcação.',
      icon: Star,
    },
    {
      href: '/administrator/embarcacoes',
      titulo: 'Embarcações',
      descricao: 'Visualize e gerencie todas as embarcações cadastradas no sistema.',
      icon: Ship,
    },
    {
      href: '/administrator/publicidade',
      titulo: 'Publicidade',
      descricao: 'Gerencie os espaços de publicidade exibidos na plataforma.',
      icon: Megaphone,
    },
    {
      href: '/administrator/taxas',
      titulo: 'Taxas',
      descricao: 'Configure a taxa geral e as taxas específicas por gestor.',
      icon: Percent,
    },
    {
      href: '/administrator/categorias',
      titulo: 'Categorias',
      descricao: 'Cadastre e organize as categorias e tipos de embarcação.',
      icon: Tags,
    },
    {
      href: '/administrator/configuracoes',
      titulo: 'Configurações',
      descricao: 'Parâmetros gerais e demais ajustes da plataforma.',
      icon: Settings,
    },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2447]">Visão Geral do Sistema</h1>
          <p className="text-sm text-slate-500 mt-1">
            Números consolidados de toda a plataforma Boatzy.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-500">
          <UserCog className="w-4 h-4 text-[#0B3D91]" />
          Administração Geral
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-start justify-between"
          >
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase mb-2">{label}</p>
              <p className="text-3xl font-bold text-[#0B2447] leading-none">{value}</p>
              <p className="text-xs text-slate-400 mt-2">{sub}</p>
            </div>
            <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Módulos de gestão */}
      <div>
        <h2 className="text-sm font-bold text-[#0B2447] tracking-wide uppercase mb-4">Módulos de Gestão</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {modulos.map(({ href, titulo, descricao, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-start gap-4 hover:border-[#0B3D91]/30 hover:shadow-md transition-all duration-150"
            >
              <div className="w-11 h-11 rounded-xl bg-[#0B2447]/5 group-hover:bg-[#0B2447] flex items-center justify-center flex-shrink-0 transition-colors">
                <Icon className="w-5 h-5 text-[#0B2447] group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0B2447] mb-1">{titulo}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{descricao}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0B3D91] mt-1 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
