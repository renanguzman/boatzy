'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, MapPin, Ship, Users, CalendarDays,
} from 'lucide-react';
import clsx from 'clsx';
import type { ReservaStatus } from '@/types/supabase';

export type ReservaEvento = {
  id: string;
  tipo: 'roteiro' | 'embarcacao';
  data_reserva: string; // 'yyyy-mm-dd'
  status: ReservaStatus;
  item_nome: string;
  quantidade_pessoas: number;
  modalidade_preco: 'roteiro' | 'diaria' | 'pessoa';
  cliente: { name: string } | null;
};

type ViewMode = 'month' | 'week';

const STATUS = {
  pendente: { label: 'Pendente', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200', bar: 'bg-amber-500' },
  aguardando_pagamento: { label: 'Aguardando pagamento', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-800 border-violet-200', bar: 'bg-violet-500' },
  confirmada: { label: 'Confirmada', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', bar: 'bg-emerald-500' },
  recusada: { label: 'Recusada', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  cancelada: { label: 'Cancelada pelo cliente', dot: 'bg-slate-400', chip: 'bg-slate-50 text-slate-500 border-slate-200', bar: 'bg-slate-400' },
  concluida: { label: 'Concluída', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 border-sky-200', bar: 'bg-sky-500' },
  expirada: { label: 'Pagamento expirado', dot: 'bg-slate-300', chip: 'bg-slate-50 text-slate-400 border-slate-200', bar: 'bg-slate-300' },
} as const;

const TIPO = {
  roteiro: { label: 'Roteiro', Icon: MapPin },
  embarcacao: { label: 'Embarcação', Icon: Ship },
} as const;

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

/** Chip de uma reserva — leva à página de detalhes. */
function EventoChip({ evento, dense }: { evento: ReservaEvento; dense?: boolean }) {
  const s = STATUS[evento.status];
  const { Icon } = TIPO[evento.tipo];
  return (
    <Link
      href={`/painel/agendamentos/${evento.id}`}
      title={`${TIPO[evento.tipo].label} · ${s.label} · ${evento.cliente?.name ?? ''}`}
      className={clsx(
        'group flex items-center gap-1.5 rounded-md border px-1.5 transition-all hover:shadow-sm hover:-translate-y-px',
        s.chip,
        dense ? 'py-0.5' : 'py-1',
      )}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate text-[11px] font-medium leading-tight">
        {evento.cliente?.name ?? evento.item_nome}
      </span>
    </Link>
  );
}

/** Mobile: um dia com suas reservas em linhas largas (fáceis de tocar). */
function DiaLista({ dia, hoje, eventos }: { dia: Date; hoje: boolean; eventos: ReservaEvento[] }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="w-10 shrink-0 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{WEEKDAYS[dia.getDay()]}</p>
        <span
          className={clsx(
            'mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
            hoje ? 'bg-[#0B3D91] text-white' : 'text-slate-700',
          )}
        >
          {dia.getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 self-center">
        {eventos.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma reserva</p>
        ) : (
          eventos.map((e) => {
            const { Icon } = TIPO[e.tipo];
            return (
              <Link
                key={e.id}
                href={`/painel/agendamentos/${e.id}`}
                className={clsx('flex items-center gap-2 rounded-lg border px-3 py-2', STATUS[e.status].chip)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight">{e.cliente?.name ?? '—'}</p>
                  <p className="truncate text-[11px] opacity-80">{e.item_nome}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] opacity-70">
                  <Users className="h-3 w-3" />
                  {e.quantidade_pessoas}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AgendamentosCalendar({ eventos }: { eventos: ReservaEvento[] }) {
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  // Mobile: dia tocado na grade do mês — a lista dele aparece abaixo.
  const [selecionado, setSelecionado] = useState<string>(() => toISO(new Date()));

  // Agrupa eventos por data ISO.
  const porData = useMemo(() => {
    const map = new Map<string, ReservaEvento[]>();
    for (const e of eventos) {
      const arr = map.get(e.data_reserva) ?? [];
      arr.push(e);
      map.set(e.data_reserva, arr);
    }
    return map;
  }, [eventos]);

  const todayISO = toISO(new Date());

  function navegar(dir: -1 | 1) {
    const d = new Date(anchor);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setAnchor(d);
    setSelecionado(toISO(d));
  }

  function irParaHoje() {
    const hoje = new Date();
    setAnchor(hoje);
    setSelecionado(toISO(hoje));
  }

  // Dias visíveis (42 no mês, 7 na semana).
  const dias = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [anchor, view]);

  const titulo = useMemo(() => {
    if (view === 'month') return `${MESES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const fmt = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
    return sameMonth
      ? `${start.getDate()}–${end.getDate()} ${MESES[start.getMonth()].toLowerCase()} ${start.getFullYear()}`
      : `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
  }, [anchor, view]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 px-4 sm:px-5 py-3 sm:py-4">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            onClick={() => navegar(-1)}
            aria-label="Anterior"
            className="h-9 w-9 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[#0B2447] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={irParaHoje}
            className="h-9 sm:h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#0B2447] transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => navegar(1)}
            aria-label="Próximo"
            className="h-9 w-9 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[#0B2447] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 sm:ml-2 text-sm sm:text-base font-bold text-[#0B2447] capitalize">{titulo}</h2>
        </div>

        {/* Segmented control Mês/Semana */}
        <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
          {(['month', 'week'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setView(m)}
              className={clsx(
                'px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-semibold transition-all',
                view === m ? 'bg-white text-[#0B2447] shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {m === 'month' ? 'Mês' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {/* Weekday header */}
      <div className={clsx('grid-cols-7 border-b border-slate-100 bg-slate-50/60', view === 'week' ? 'hidden md:grid' : 'grid')}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      {view === 'month' ? (
        <div className="grid grid-cols-7">
          {dias.map((dia, i) => {
            const iso = toISO(dia);
            const evs = porData.get(iso) ?? [];
            const foraDoMes = dia.getMonth() !== anchor.getMonth();
            const hoje = iso === todayISO;
            const visiveis = evs.slice(0, 3);
            const resto = evs.length - visiveis.length;
            return (
              <div
                key={i}
                onClick={() => setSelecionado(iso)}
                className={clsx(
                  'min-h-[56px] md:min-h-[112px] border-b border-r border-slate-100 p-1 md:p-1.5 [&:nth-child(7n)]:border-r-0 cursor-pointer md:cursor-default',
                  foraDoMes ? 'bg-slate-50/40' : 'bg-white',
                  iso === selecionado && 'max-md:bg-[#0B3D91]/5 max-md:ring-1 max-md:ring-inset max-md:ring-[#0B3D91]/30',
                )}
              >
                <div className="flex justify-center md:justify-end">
                  <span
                    className={clsx(
                      'inline-flex h-7 w-7 md:h-6 md:w-6 items-center justify-center rounded-full text-xs font-semibold',
                      hoje
                        ? 'bg-[#0B3D91] text-white'
                        : foraDoMes
                          ? 'text-slate-300'
                          : 'text-slate-600',
                    )}
                  >
                    {dia.getDate()}
                  </span>
                </div>
                {/* Mobile: só pontos de status; a lista do dia fica abaixo da grade. */}
                {evs.length > 0 && (
                  <div className="md:hidden mt-1 flex flex-wrap justify-center gap-0.5">
                    {evs.slice(0, 4).map((e) => (
                      <span key={e.id} className={clsx('h-1.5 w-1.5 rounded-full', STATUS[e.status].dot)} />
                    ))}
                  </div>
                )}
                <div className="hidden md:block mt-1 space-y-1">
                  {visiveis.map((e) => (
                    <EventoChip key={e.id} evento={e} dense />
                  ))}
                  {resto > 0 && (
                    <span className="block px-1 text-[10px] font-semibold text-slate-400">+{resto} mais</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
        {/* Mobile: a semana vira uma lista vertical de dias. */}
        <div className="md:hidden divide-y divide-slate-100 border-b border-slate-100">
          {dias.map((dia) => {
            const iso = toISO(dia);
            return (
              <DiaLista
                key={iso}
                dia={dia}
                hoje={iso === todayISO}
                eventos={porData.get(iso) ?? []}
              />
            );
          })}
        </div>

        <div className="hidden md:grid grid-cols-7">
          {dias.map((dia, i) => {
            const iso = toISO(dia);
            const evs = porData.get(iso) ?? [];
            const hoje = iso === todayISO;
            return (
              <div
                key={i}
                className="min-h-[340px] border-b border-r border-slate-100 p-2 [&:nth-child(7n)]:border-r-0"
              >
                <div className="mb-2 flex flex-col items-center">
                  <span
                    className={clsx(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                      hoje ? 'bg-[#0B3D91] text-white' : 'text-slate-700',
                    )}
                  >
                    {dia.getDate()}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {evs.length === 0 ? (
                    <p className="pt-2 text-center text-[10px] text-slate-300">—</p>
                  ) : (
                    evs.map((e) => (
                      <Link
                        key={e.id}
                        href={`/painel/agendamentos/${e.id}`}
                        className={clsx(
                          'block rounded-lg border p-2 transition-all hover:shadow-sm hover:-translate-y-px',
                          STATUS[e.status].chip,
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const { Icon } = TIPO[e.tipo];
                            return <Icon className="h-3 w-3 shrink-0 opacity-70" />;
                          })()}
                          <span className="truncate text-[11px] font-semibold leading-tight">
                            {e.cliente?.name ?? '—'}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] opacity-80">{e.item_nome}</p>
                        <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                          <Users className="h-2.5 w-2.5" />
                          {e.quantidade_pessoas}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Mobile, visão mês: reservas do dia tocado. */}
      {view === 'month' && (
        <div className="md:hidden border-b border-slate-100">
          <DiaLista
            dia={new Date(`${selecionado}T12:00:00`)}
            hoje={selecionado === todayISO}
            eventos={porData.get(selecionado) ?? []}
          />
        </div>
      )}

      {/* Legendas */}
      <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 border-t border-slate-100 px-4 sm:px-5 py-3.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" /> Legenda
        </span>
        {Object.values(STATUS).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={clsx('h-2.5 w-2.5 rounded-full', s.dot)} />
            {s.label}
          </span>
        ))}
        <span className="hidden sm:block mx-1 h-4 w-px bg-slate-200" />
        {Object.values(TIPO).map(({ label, Icon }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <Icon className="h-3.5 w-3.5 text-slate-400" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
