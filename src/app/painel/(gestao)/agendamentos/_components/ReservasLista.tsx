'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight, ChevronDown, ChevronUp, Clock, Users, CalendarDays, Sparkles, History, Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import type { PedidoStatus, ReservaStatus } from '@/types/supabase';
import { hojeISO } from '@/lib/datas';
import { formatCurrency } from '@/lib/utils';
import { MESES, STATUS, TIPO, WEEKDAYS, type ReservaEvento } from './AgendamentosCalendar';

/** Reservas que ainda vão acontecer de fato (as demais aparecem esmaecidas). */
const ATIVAS: ReservaStatus[] = ['pendente', 'aguardando_pagamento', 'confirmada'];
/** Quantas reservas passadas aparecem antes de "ver anteriores". */
const PASSADAS_VISIVEIS = 3;

const STATUS_BADGE: Record<ReservaStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  aguardando_pagamento: 'bg-violet-100 text-violet-700',
  confirmada: 'bg-emerald-100 text-emerald-700',
  recusada: 'bg-red-100 text-red-600',
  cancelada: 'bg-slate-200 text-slate-600',
  concluida: 'bg-sky-100 text-sky-700',
  expirada: 'bg-slate-100 text-slate-500',
};

const PEDIDO_STATUS: Record<PedidoStatus, { label: string; badge: string }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', badge: 'bg-violet-50 text-violet-700 ring-violet-200' },
  pago: { label: 'Pago', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  expirado: { label: 'Pagamento expirado', badge: 'bg-slate-50 text-slate-500 ring-slate-200' },
  cancelado: { label: 'Pagamento cancelado', badge: 'bg-slate-50 text-slate-500 ring-slate-200' },
  reembolsado: { label: 'Reembolsado', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  reembolsado_parcial: { label: 'Reembolsado parcialmente', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  em_disputa: { label: 'Pagamento em disputa', badge: 'bg-red-50 text-red-600 ring-red-200' },
};

type Pagamento = { label: string; badge: string; valor: number | null };

/** Situação do pagamento: pedido no Boatzy ou, sem pedido, o que isso significa para o status. */
function pagamentoDe(e: ReservaEvento): Pagamento {
  const pedido = Array.isArray(e.pedido) ? (e.pedido[0] ?? null) : e.pedido;
  if (pedido) return { ...PEDIDO_STATUS[pedido.status], valor: pedido.valor_total };
  const neutro = 'bg-slate-50 text-slate-500 ring-slate-200';
  if (e.status === 'pendente') return { label: 'Cobrança após o aceite', badge: neutro, valor: e.total_estimado };
  if (e.status === 'confirmada' || e.status === 'concluida') {
    return { label: 'Pagamento direto com o cliente', badge: 'bg-sky-50 text-sky-700 ring-sky-200', valor: e.total_estimado };
  }
  return { label: 'Sem cobrança', badge: neutro, valor: e.total_estimado };
}

function partes(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return { ano, mes: mes - 1, dia, semana: new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay() };
}

function diasEntre(deISO: string, ateISO: string): number {
  const a = partes(deISO);
  const b = partes(ateISO);
  return Math.round((Date.UTC(b.ano, b.mes, b.dia) - Date.UTC(a.ano, a.mes, a.dia)) / 86_400_000);
}

function quando(iso: string, hoje: string): string {
  const d = diasEntre(hoje, iso);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Ontem';
  return d > 0 ? `Em ${d} dias` : `Há ${-d} dias`;
}

function dataCurta(iso: string): string {
  const p = partes(iso);
  return `${String(p.dia).padStart(2, '0')} ${MESES[p.mes].slice(0, 3).toLowerCase()}`;
}

/** Horário de saída do roteiro; embarcação por diária é o dia inteiro. */
function horario(e: ReservaEvento): string {
  const h = e.roteiro?.horario_saida;
  if (h) return h.slice(0, 5);
  return e.tipo === 'embarcacao' ? 'Dia inteiro' : 'Horário a combinar';
}

function periodo(e: ReservaEvento): string | null {
  if (!e.data_fim_reserva || e.data_fim_reserva === e.data_reserva) return null;
  const n = e.quantidade_diarias ?? diasEntre(e.data_reserva, e.data_fim_reserva) + 1;
  return `${dataCurta(e.data_reserva)} → ${dataCurta(e.data_fim_reserva)} · ${n} diária${n !== 1 ? 's' : ''}`;
}

function agruparPorMes(eventos: ReservaEvento[]) {
  const grupos: { chave: string; titulo: string; itens: ReservaEvento[] }[] = [];
  for (const e of eventos) {
    const chave = e.data_reserva.slice(0, 7);
    let g = grupos[grupos.length - 1];
    if (!g || g.chave !== chave) {
      const p = partes(e.data_reserva);
      g = { chave, titulo: `${MESES[p.mes]} ${p.ano}`, itens: [] };
      grupos.push(g);
    }
    g.itens.push(e);
  }
  return grupos;
}

function Badges({ e, pg }: { e: ReservaEvento; pg: Pagamento }) {
  return (
    <>
      <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_BADGE[e.status])}>
        {STATUS[e.status].label}
      </span>
      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', pg.badge)}>
        <Wallet className="h-3 w-3" />
        {pg.label}
      </span>
      {(e.avulsas_abertas ?? 0) > 0 && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          {e.avulsas_abertas} cobrança{e.avulsas_abertas !== 1 ? 's' : ''} adicional{e.avulsas_abertas !== 1 ? 'is' : ''} em aberto
        </span>
      )}
    </>
  );
}

/** Destaque máximo: a(s) reserva(s) do dia mais próximo. */
function ProximaCard({ e, hoje }: { e: ReservaEvento; hoje: string }) {
  const p = partes(e.data_reserva);
  const pg = pagamentoDe(e);
  const { Icon, label: tipoLabel } = TIPO[e.tipo];
  const per = periodo(e);
  return (
    <Link
      href={`/painel/agendamentos/${e.id}`}
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B2447] to-[#0B3D91] p-4 sm:p-5 text-white shadow-lg shadow-[#0B3D91]/20 ring-1 ring-[#0B3D91]/30 transition-all hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-200">
        <Sparkles className="h-3.5 w-3.5" />
        Próxima reserva · {quando(e.data_reserva, hoje)}
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0 sm:w-20 shrink-0 sm:rounded-xl sm:bg-white/10 sm:py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-100">{WEEKDAYS[p.semana]}</span>
          <span className="text-3xl sm:text-4xl font-extrabold leading-none">{p.dia}</span>
          <span className="text-xs font-medium uppercase text-sky-100">{MESES[p.mes].slice(0, 3)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg sm:text-xl font-bold">{e.cliente?.name ?? '—'}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-sky-100">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{e.item_nome}</span>
            <span className="shrink-0 text-sky-200/70">· {tipoLabel}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{horario(e)}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{e.quantidade_pessoas} pessoa{e.quantidade_pessoas !== 1 ? 's' : ''}</span>
            {per && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{per}</span>}
            {pg.valor != null && <span className="font-semibold">{formatCurrency(pg.valor)}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badges e={e} pg={pg} />
          </div>
        </div>

        <span className="inline-flex items-center justify-center gap-1 self-start sm:self-center rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-[#0B2447] transition-colors group-hover:bg-sky-50">
          Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

/** Linha da linha do tempo. `passada` = menor destaque; futuras canceladas/recusadas também esmaecem. */
function ItemLinha({ e, hoje, passada }: { e: ReservaEvento; hoje: string; passada?: boolean }) {
  const p = partes(e.data_reserva);
  const pg = pagamentoDe(e);
  const { Icon } = TIPO[e.tipo];
  const inativa = !ATIVAS.includes(e.status);
  const apagada = passada || inativa;
  const per = periodo(e);
  return (
    <li className="relative pl-8 sm:pl-10">
      {/* Ponto na linha do tempo */}
      <span
        className={clsx(
          'absolute left-[7px] sm:left-[11px] top-5 h-3 w-3 rounded-full ring-4',
          apagada ? 'bg-slate-300 ring-white' : clsx(STATUS[e.status].dot, 'ring-white'),
        )}
      />
      <Link
        href={`/painel/agendamentos/${e.id}`}
        className={clsx(
          'group flex items-start sm:items-center gap-3 sm:gap-4 rounded-xl border px-3 py-3 sm:px-4 transition-all',
          apagada
            ? 'border-slate-100 bg-slate-50/60 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
            : 'border-slate-200 bg-white shadow-sm hover:-translate-y-px hover:shadow-md hover:border-[#0B3D91]/30',
        )}
      >
        <div className={clsx('w-12 shrink-0 text-center', apagada && 'opacity-70')}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{WEEKDAYS[p.semana]}</p>
          <p className={clsx('text-xl font-bold leading-tight', apagada ? 'text-slate-400' : 'text-[#0B2447]')}>{p.dia}</p>
          <p className="text-[10px] uppercase text-slate-400">{MESES[p.mes].slice(0, 3)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={clsx('truncate text-sm font-semibold', apagada ? 'text-slate-500' : 'text-slate-800 group-hover:text-[#0B2447]')}>
              {e.cliente?.name ?? '—'}
            </p>
            <span className={clsx('shrink-0 text-[11px] font-medium', apagada ? 'text-slate-400' : 'text-[#0B3D91]')}>
              {quando(e.data_reserva, hoje)}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{e.item_nome}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{horario(e)}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.quantidade_pessoas}</span>
            {per && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{per}</span>}
            {pg.valor != null && <span className="font-semibold text-slate-600">{formatCurrency(pg.valor)}</span>}
          </div>
          <div className={clsx('mt-2 flex flex-wrap items-center gap-1.5 md:hidden', apagada && 'opacity-80')}>
            <Badges e={e} pg={pg} />
          </div>
        </div>

        <div className={clsx('hidden md:flex max-w-[45%] flex-wrap items-center justify-end gap-1.5', apagada && 'opacity-80')}>
          <Badges e={e} pg={pg} />
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-300 group-hover:text-[#0B3D91]" />
      </Link>
    </li>
  );
}

function Grupos({ eventos, hoje, passada }: { eventos: ReservaEvento[]; hoje: string; passada?: boolean }) {
  return (
    <>
      {agruparPorMes(eventos).map((g) => (
        <div key={g.chave}>
          <p className={clsx('relative mb-2 mt-4 pl-8 sm:pl-10 text-[11px] font-bold uppercase tracking-wider', passada ? 'text-slate-300' : 'text-slate-400')}>
            {g.titulo}
          </p>
          <ul className="space-y-2">
            {g.itens.map((e) => (
              <ItemLinha key={e.id} e={e} hoje={hoje} passada={passada} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function ReservasLista({ eventos }: { eventos: ReservaEvento[] }) {
  const [verTodasPassadas, setVerTodasPassadas] = useState(false);
  const hoje = hojeISO();

  const { passadas, destaque, proximas } = useMemo(() => {
    const ordenadas = [...eventos].sort((a, b) =>
      a.data_reserva.localeCompare(b.data_reserva) ||
      (a.roteiro?.horario_saida ?? '').localeCompare(b.roteiro?.horario_saida ?? ''),
    );
    const passadas = ordenadas.filter((e) => e.data_reserva < hoje);
    const futuras = ordenadas.filter((e) => e.data_reserva >= hoje);
    // Destaque: as reservas ativas do dia mais próximo (pode haver mais de uma no mesmo dia).
    const dataProxima = futuras.find((e) => ATIVAS.includes(e.status))?.data_reserva;
    const destaque = futuras.filter((e) => e.data_reserva === dataProxima && ATIVAS.includes(e.status));
    const proximas = futuras.filter((e) => !destaque.includes(e));
    return { passadas, destaque, proximas };
  }, [eventos, hoje]);

  const ocultas = verTodasPassadas ? 0 : Math.max(0, passadas.length - PASSADAS_VISIVEIS);
  const passadasVisiveis = passadas.slice(ocultas);
  const hp = partes(hoje);

  if (eventos.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
        <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-600">Nenhuma reserva ainda</p>
        <p className="mt-1 text-xs text-slate-400">As solicitações dos seus roteiros e embarcações aparecem aqui.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 px-4 sm:px-5 py-3 sm:py-4">
        <h2 className="text-sm sm:text-base font-bold text-[#0B2447]">Linha do tempo</h2>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span><strong className="text-[#0B2447]">{destaque.length + proximas.length}</strong> por vir</span>
          <span className="h-3 w-px bg-slate-200" />
          <span><strong className="text-slate-600">{passadas.length}</strong> já passaram</span>
        </div>
      </div>

      <div className="relative px-3 sm:px-5 pb-5">
        {/* Linha vertical */}
        <span className="pointer-events-none absolute bottom-5 top-4 left-[25px] sm:left-[37px] w-px bg-slate-200" />

        {passadas.length > 0 && (
          <div className="relative">
            {passadas.length > PASSADAS_VISIVEIS && (
              <div className="relative pl-8 sm:pl-10 pt-4">
                <button
                  onClick={() => setVerTodasPassadas((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-[#0B2447]"
                >
                  <History className="h-3.5 w-3.5" />
                  {verTodasPassadas ? (
                    <>Ocultar reservas antigas <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Ver {ocultas} reserva{ocultas !== 1 ? 's' : ''} anterior{ocultas !== 1 ? 'es' : ''} <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </button>
              </div>
            )}
            <Grupos eventos={passadasVisiveis} hoje={hoje} passada />
          </div>
        )}

        {/* Marcador de hoje */}
        <div className="relative mt-5 mb-3 flex items-center gap-3 pl-8 sm:pl-10">
          <span className="absolute left-[3px] sm:left-[7px] h-5 w-5 rounded-full bg-[#0B3D91] ring-4 ring-[#0B3D91]/15" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#0B3D91]">
            Hoje · {hp.dia} de {MESES[hp.mes].toLowerCase()}
          </span>
          <span className="h-px flex-1 bg-[#0B3D91]/15" />
        </div>

        {destaque.length > 0 ? (
          <div className="relative space-y-3 pl-8 sm:pl-10">
            {destaque.map((e) => (
              <ProximaCard key={e.id} e={e} hoje={hoje} />
            ))}
          </div>
        ) : (
          <p className="relative pl-8 sm:pl-10 text-sm text-slate-400">Nenhuma reserva ativa por vir.</p>
        )}

        {proximas.length > 0 && <Grupos eventos={proximas} hoje={hoje} />}
      </div>
    </div>
  );
}
