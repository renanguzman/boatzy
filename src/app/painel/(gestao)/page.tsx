'use client';

import {
  TrendingUp,
  Ship,
  Clock,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

/* ── Mock data ── */
const stats = [
  {
    label: 'TOTAL REVENUE',
    value: '$482,900',
    sub: '~12% vs last month',
    icon: TrendingUp,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    label: 'ACTIVE CHARTERS',
    value: '24',
    sub: '8 currently at sea',
    subDot: true,
    icon: Ship,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    label: 'PENDING APPROVALS',
    value: '12',
    sub: '! High Priority',
    subAlert: true,
    icon: Clock,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    label: 'FLEET UTILIZATION',
    value: '89%',
    progress: 89,
    icon: BarChart3,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
];

const bookingData = [
  { month: 'JAN', value: 25 },
  { month: 'FEB', value: 15 },
  { month: 'MAR', value: 35 },
  { month: 'APR', value: 55 },
  { month: 'MAY', value: 75 },
  { month: 'JUN', value: 45 },
];

const recentActivities = [
  {
    entity: 'Azure Horizon',
    type: 'Charter',
    customer: 'James Morrison',
    amount: '$12,500',
    status: 'Confirmed',
    date: 'May 10, 2024',
  },
  {
    entity: 'Silver Wave',
    type: 'Maintenance',
    customer: '—',
    amount: '$3,200',
    status: 'In Progress',
    date: 'May 9, 2024',
  },
  {
    entity: 'Ocean Pearl',
    type: 'Charter',
    customer: 'Sarah Chen',
    amount: '$8,750',
    status: 'Pending',
    date: 'May 8, 2024',
  },
  {
    entity: 'Neptune Star',
    type: 'Charter',
    customer: 'Robert Liu',
    amount: '$15,000',
    status: 'Confirmed',
    date: 'May 7, 2024',
  },
];

export default function PainelDashboardPage() {
  const maxBarValue = Math.max(...bookingData.map((d) => d.value));

  return (
    <div className="p-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
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
            {stat.sub && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                {stat.subDot && (
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                )}
                {stat.subAlert && (
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                )}
                <span className={stat.subAlert ? 'text-amber-600 font-medium' : ''}>
                  {stat.sub}
                </span>
              </p>
            )}
            {stat.progress !== undefined && (
              <div className="mt-2">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0B3D91] rounded-full transition-all duration-700"
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts + Top Performer Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Booking Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-base font-bold text-[#0B2447]">Booking Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Reservation volume across all vessel categories
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button className="px-3 py-1.5 rounded-md bg-[#0B2447] text-white text-xs font-semibold transition-all">
                Monthly
              </button>
              <button className="px-3 py-1.5 rounded-md text-slate-500 text-xs font-semibold hover:text-[#0B2447] transition-all">
                Weekly
              </button>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="mt-6 flex items-end justify-between gap-4 h-48 px-2">
            {bookingData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex justify-center">
                  <div
                    className="w-10 rounded-t-lg transition-all duration-500 hover:opacity-80"
                    style={{
                      height: `${(d.value / maxBarValue) * 160}px`,
                      backgroundColor:
                        d.value === maxBarValue ? '#0B2447' : '#CBD5E1',
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                  {d.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performer Card */}
        <div className="bg-[#0B2447] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-400">
                Top Performer
              </span>
              <BarChart3 className="w-5 h-5 text-white/40" />
            </div>

            <h4 className="text-lg font-bold mb-2">
              The Azure Horizon Luxury Cruiser
            </h4>
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              Generating 22% of total fleet revenue this quarter.
            </p>

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                Status
              </span>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Fully Booked
              </span>
            </div>

            <button className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold text-sm py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2">
              View Analytics
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-[#0B2447]">Recent Activities</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor real-time bookings and inquiries
            </p>
          </div>
          <button className="flex items-center gap-1 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors">
            View All
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Entity</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Type</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Customer</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Amount / Status</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Date</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((activity, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 text-sm font-medium text-[#0B2447]">
                    {activity.entity}
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        activity.type === 'Charter'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {activity.type}
                    </span>
                  </td>
                  <td className="py-3.5 text-sm text-slate-600">{activity.customer}</td>
                  <td className="py-3.5">
                    <div className="text-sm font-semibold text-[#0B2447]">{activity.amount}</div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        activity.status === 'Confirmed'
                          ? 'text-emerald-600'
                          : activity.status === 'Pending'
                          ? 'text-amber-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {activity.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-sm text-slate-500">{activity.date}</td>
                  <td className="py-3.5">
                    <button className="text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors">
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
