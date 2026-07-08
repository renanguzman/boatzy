'use client';

import { TrendingUp, TrendingDown, Minus, DollarSign, Receipt, Users, Clock, Ticket } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrencyPrecise } from '@/lib/utils';

// Cor de marca (#0B3D91) clareada para servir de mark de gráfico — o navy/azul
// originais do app são escuros/pouco saturados demais para ler como barra
// (validado com scripts/validate_palette.js do skill dataviz: falha lightness
// band e chroma floor; #1857C4 passa todos os checks contra fundo branco).
const MARK = '#1857C4';
const INK = '#0B2447';
const MUTED = '#94A3B8'; // slate-400
const GRID = '#F1F5F9'; // slate-100

type Kpis = {
  receita: number;
  receitaAnterior: number;
  variacaoPct: number | null;
  ticketMedio: number;
  totalReservas: number;
  valorPendente: number;
};

function KpiTile({
  icon: Icon, label, value, delta, sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: { pct: number } | null;
  sublabel?: string;
}) {
  const deltaColor = delta == null ? MUTED : delta.pct > 0 ? '#0ca30c' : delta.pct < 0 ? '#d03b3b' : MUTED;
  const DeltaIcon = delta == null || delta.pct === 0 ? Minus : delta.pct > 0 ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] font-bold tracking-wider uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#0B2447] leading-tight">{value}</p>
      <div className="mt-1.5 h-4 flex items-center gap-1">
        {delta !== undefined && delta !== null && (
          <>
            <DeltaIcon className="w-3.5 h-3.5" style={{ color: deltaColor }} />
            <span className="text-xs font-semibold" style={{ color: deltaColor }}>
              {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400">vs. período anterior</span>
          </>
        )}
        {sublabel && <span className="text-xs text-slate-400">{sublabel}</span>}
      </div>
    </div>
  );
}

const MAX_TICK_CHARS = 16;

function truncar(nome: string): string {
  return nome.length > MAX_TICK_CHARS ? `${nome.slice(0, MAX_TICK_CHARS - 1)}…` : nome;
}

// Nomes de embarcação/roteiro costumam ser títulos longos — trunca o rótulo do
// eixo (o valor completo continua disponível no tooltip via hover/foco).
function TickTruncado({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (x == null || y == null || !payload) return null;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={INK}>
      {truncar(String(payload.value))}
    </text>
  );
}

function TooltipValor({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[#0B2447] mb-0.5">{label}</p>
      <p className="text-slate-600">{formatCurrencyPrecise(payload[0].value)}</p>
    </div>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-[#0B2447] mb-4">{title}</h3>
      {empty ? (
        <div className="h-52 flex items-center justify-center text-sm text-slate-400">
          Sem dados no período selecionado
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default function ReceitasInsights({
  kpis,
  tendenciaMensal,
  porEmbarcacao,
  porRoteiro,
  topClientes,
}: {
  kpis: Kpis;
  tendenciaMensal: { mes: string; valor: number }[];
  porEmbarcacao: { nome: string; valor: number }[];
  porRoteiro: { nome: string; valor: number }[];
  topClientes: { nome: string; valor: number; reservas: number }[];
}) {
  const alturaRanking = (n: number) => Math.max(160, n * 36);

  return (
    <div className="space-y-6 mb-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiTile
          icon={DollarSign}
          label="Receita no período"
          value={formatCurrencyPrecise(kpis.receita)}
          delta={kpis.variacaoPct == null ? null : { pct: kpis.variacaoPct }}
        />
        <KpiTile
          icon={Ticket}
          label="Ticket médio"
          value={formatCurrencyPrecise(kpis.ticketMedio)}
          sublabel="por reserva confirmada"
        />
        <KpiTile
          icon={Receipt}
          label="Reservas confirmadas"
          value={String(kpis.totalReservas)}
        />
        <KpiTile
          icon={Clock}
          label="Valor pendente"
          value={formatCurrencyPrecise(kpis.valorPendente)}
          sublabel="aguardando confirmação"
        />
        <KpiTile
          icon={Users}
          label="Clientes no período"
          value={String(topClientes.length)}
        />
      </div>

      {/* Tendência mensal */}
      <ChartCard title="Receita por mês" empty={tendenciaMensal.every((m) => m.valor === 0)}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={tendenciaMensal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: MUTED }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrencyPrecise(v).replace(/ /, ' ')}
              width={72}
            />
            <Tooltip content={<TooltipValor />} cursor={{ fill: GRID }} />
            <Bar dataKey="valor" name="Receita" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por embarcação */}
        <ChartCard title="Receita por embarcação" empty={porEmbarcacao.length === 0}>
          <ResponsiveContainer width="100%" height={alturaRanking(porEmbarcacao.length)}>
            <BarChart
              data={porEmbarcacao}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} hide />
              <YAxis
                type="category"
                dataKey="nome"
                tick={<TickTruncado />}
                axisLine={false}
                tickLine={false}
                width={130}
              />
              <Tooltip content={<TooltipValor />} cursor={{ fill: GRID }} />
              <Bar dataKey="valor" name="Receita" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Por roteiro */}
        <ChartCard title="Receita por roteiro" empty={porRoteiro.length === 0}>
          <ResponsiveContainer width="100%" height={alturaRanking(porRoteiro.length)}>
            <BarChart
              data={porRoteiro}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} hide />
              <YAxis
                type="category"
                dataKey="nome"
                tick={<TickTruncado />}
                axisLine={false}
                tickLine={false}
                width={130}
              />
              <Tooltip content={<TooltipValor />} cursor={{ fill: GRID }} />
              <Bar dataKey="valor" name="Receita" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top clientes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#0B2447] mb-4">Top clientes por receita</h3>
        {topClientes.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-slate-400">
            Sem dados no período selecionado
          </div>
        ) : (
          <div className="space-y-2.5">
            {topClientes.map((c, i) => (
              <div key={c.nome} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-slate-300 text-right shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm text-slate-700 truncate">{c.nome}</span>
                <span className="text-xs text-slate-400 shrink-0">{c.reservas} reserva{c.reservas !== 1 ? 's' : ''}</span>
                <span className="text-sm font-semibold text-[#0B2447] shrink-0 w-28 text-right">
                  {formatCurrencyPrecise(c.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
