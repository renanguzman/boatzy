import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Ship,
  Clock,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  Map as MapIcon,
  Users,
  MapPin,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { concluirReservasVencidas } from '@/lib/reservas';
import { formatCurrency } from '@/lib/utils';
import type { ReservaStatus, ReservaTipo } from '@/types/supabase';

type ReservaDashboard = {
  id: string;
  tipo: ReservaTipo;
  status: ReservaStatus;
  item_nome: string;
  data_reserva: string;
  quantidade_pessoas: number;
  total_estimado: number | null;
  solicitado_em: string;
  cliente_id: string;
  roteiro_id: string | null;
  embarcacao_id: string | null;
  cliente: { name: string } | null;
};

const STATUS_BADGE: Record<ReservaStatus, { label: string; class: string }> = {
  pendente: { label: 'Pendente', class: 'text-amber-600' },
  confirmada: { label: 'Confirmada', class: 'text-emerald-600' },
  recusada: { label: 'Recusada', class: 'text-red-500' },
  cancelada: { label: 'Cancelada pelo cliente', class: 'text-slate-500' },
  concluida: { label: 'Concluída', class: 'text-sky-600' },
};

const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function formatDataCurta(iso: string): string {
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default async function PainelDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/painel/login');

  // Transição lazy confirmada → concluída antes de contar/exibir status.
  await concluirReservasVencidas();

  const [{ data: embarcacoesData }, { data: roteirosData }, { data: reservasData }] =
    await Promise.all([
      supabaseAdmin.from('embarcacao').select('id, status').eq('owner_id', user.id),
      supabaseAdmin.from('roteiro').select('id, ativo').eq('owner_id', user.id),
      supabaseAdmin
        .from('reserva')
        .select(
          `id, tipo, status, item_nome, data_reserva, quantidade_pessoas, total_estimado,
           solicitado_em, cliente_id, roteiro_id, embarcacao_id,
           cliente:users!reserva_cliente_id_fkey ( name )`,
        )
        .eq('owner_id', user.id)
        .order('solicitado_em', { ascending: false }),
    ]);

  const embarcacoes = embarcacoesData ?? [];
  const roteiros = roteirosData ?? [];
  const reservas = (reservasData ?? []) as unknown as ReservaDashboard[];

  /* ── Cards ── */
  const pendentes = reservas.filter((r) => r.status === 'pendente').length;
  const embarcacoesAtivas = embarcacoes.filter((e) => e.status === 'ativo').length;
  const roteirosAtivos = roteiros.filter((r) => r.ativo).length;
  const totalClientes = new Set(reservas.map((r) => r.cliente_id)).size;

  const stats = [
    {
      label: 'Agendamentos pendentes',
      value: String(pendentes),
      sub: `${reservas.length} agendamento${reservas.length !== 1 ? 's' : ''} no total`,
      subAlert: pendentes > 0,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      href: '/painel/agendamentos',
    },
    {
      label: 'Embarcações',
      value: String(embarcacoes.length),
      sub: `${embarcacoesAtivas} ativa${embarcacoesAtivas !== 1 ? 's' : ''}`,
      subDot: embarcacoesAtivas > 0,
      icon: Ship,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      href: '/painel/embarcacoes',
    },
    {
      label: 'Roteiros',
      value: String(roteiros.length),
      sub: `${roteirosAtivos} ativo${roteirosAtivos !== 1 ? 's' : ''}`,
      subDot: roteirosAtivos > 0,
      icon: MapIcon,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      href: '/painel/roteiros',
    },
    {
      label: 'Clientes',
      value: String(totalClientes),
      sub: 'com pelo menos 1 reserva',
      icon: Users,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      href: '/painel/clientes',
    },
  ];

  /* ── Gráfico: reservas solicitadas nos últimos 6 meses ── */
  const agora = new Date();
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), label: MESES_CURTOS[d.getMonth()], total: 0 };
  });
  const inicioJanela = new Date(meses[0].ano, meses[0].mes, 1);
  for (const r of reservas) {
    const d = new Date(r.solicitado_em);
    if (d < inicioJanela) continue;
    const bucket = meses.find((m) => m.ano === d.getFullYear() && m.mes === d.getMonth());
    if (bucket) bucket.total += 1;
  }
  const maxMes = Math.max(1, ...meses.map((m) => m.total));

  /* ── Destaque: item com mais reservas na janela de 6 meses ── */
  const porItem = new Map<string, { nome: string; tipo: ReservaTipo; roteiroId: string | null; total: number }>();
  let reservasJanela = 0;
  for (const r of reservas) {
    if (new Date(r.solicitado_em) < inicioJanela) continue;
    reservasJanela += 1;
    const key = `${r.tipo}:${r.roteiro_id ?? r.embarcacao_id ?? r.item_nome}`;
    const atual = porItem.get(key) ?? { nome: r.item_nome, tipo: r.tipo, roteiroId: r.roteiro_id, total: 0 };
    atual.total += 1;
    porItem.set(key, atual);
  }
  const destaque = [...porItem.values()].sort((a, b) => b.total - a.total)[0] ?? null;
  const destaquePercent = destaque && reservasJanela > 0
    ? Math.round((destaque.total / reservasJanela) * 100)
    : 0;

  /* ── Últimas solicitações ── */
  const recentes = reservas.slice(0, 6);

  return (
    <div className="p-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                {stat.label}
              </p>
              <div className={`w-9 h-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#0B2447] mb-1">{stat.value}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              {stat.subDot && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
              {stat.subAlert && <AlertTriangle className="w-3 h-3 text-amber-500" />}
              <span className={stat.subAlert ? 'text-amber-600 font-medium' : ''}>{stat.sub}</span>
            </p>
          </Link>
        ))}
      </div>

      {/* Gráfico + Destaque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Reservas solicitadas nos últimos 6 meses */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-base font-bold text-[#0B2447]">Reservas solicitadas</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Solicitações recebidas por mês (roteiros e embarcações)
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-500 text-xs font-semibold">
              Últimos 6 meses
            </span>
          </div>

          {/* Bar Chart */}
          <div className="mt-6 flex items-end justify-between gap-4 h-48 px-2">
            {meses.map((m) => (
              <div key={`${m.ano}-${m.mes}`} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                  {m.total > 0 ? m.total : ''}
                </span>
                <div className="w-full flex justify-center">
                  <div
                    className="w-10 rounded-t-lg transition-all duration-500 hover:opacity-80"
                    style={{
                      height: `${Math.max(m.total > 0 ? 8 : 2, (m.total / maxMes) * 150)}px`,
                      backgroundColor:
                        m.total === maxMes && m.total > 0 ? '#0B2447' : '#CBD5E1',
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Destaque dos últimos 6 meses */}
        <div className="bg-[#0B2447] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-400">
                Destaque do período
              </span>
              <BarChart3 className="w-5 h-5 text-white/40" />
            </div>

            {destaque ? (
              <>
                <h4 className="text-lg font-bold mb-2">{destaque.nome}</h4>
                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  {destaquePercent}% das solicitações dos últimos 6 meses
                  ({destaque.total} reserva{destaque.total !== 1 ? 's' : ''}).
                </p>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                    Tipo
                  </span>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    {destaque.tipo === 'embarcacao' ? 'Embarcação' : 'Roteiro'}
                  </span>
                </div>

                <Link
                  href="/painel/agendamentos"
                  className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold text-sm py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  Ver agendamentos
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <h4 className="text-lg font-bold mb-2">Sem reservas no período</h4>
                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  Quando você receber solicitações, o roteiro ou embarcação mais procurado aparece aqui.
                </p>
                <Link
                  href="/painel/roteiros"
                  className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold text-sm py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  Gerenciar roteiros
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Últimas solicitações de reserva */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-[#0B2447]">Últimas solicitações de reserva</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              As solicitações mais recentes dos seus roteiros e embarcações
            </p>
          </div>
          <Link
            href="/painel/agendamentos"
            className="flex items-center gap-1 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
          >
            Ver todas
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400 font-medium">Você ainda não recebeu solicitações de reserva.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Item</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Cliente</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Data do passeio</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Pessoas</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Total / Status</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Solicitada em</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((r) => {
                  const s = STATUS_BADGE[r.status];
                  const TipoIcon = r.tipo === 'embarcacao' ? Ship : MapPin;
                  return (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="text-sm font-medium text-[#0B2447]">{r.item_nome}</div>
                        <span
                          className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            r.tipo === 'embarcacao' ? 'bg-blue-50 text-blue-700' : 'bg-cyan-50 text-cyan-700'
                          }`}
                        >
                          <TipoIcon className="w-2.5 h-2.5" />
                          {r.tipo === 'embarcacao' ? 'Embarcação' : 'Roteiro'}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-sm text-slate-600">{r.cliente?.name ?? '—'}</td>
                      <td className="py-3.5 pr-4 text-sm text-slate-600">{formatDataCurta(r.data_reserva)}</td>
                      <td className="py-3.5 pr-4 text-sm text-slate-600">{r.quantidade_pessoas}</td>
                      <td className="py-3.5 pr-4">
                        <div className="text-sm font-semibold text-[#0B2447]">
                          {r.total_estimado != null ? formatCurrency(r.total_estimado) : '—'}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${s.class}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-sm text-slate-500">{formatDataCurta(r.solicitado_em)}</td>
                      <td className="py-3.5">
                        <Link
                          href={`/painel/agendamentos/${r.id}`}
                          className="text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
