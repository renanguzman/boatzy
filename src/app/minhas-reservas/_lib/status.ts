import {
  Ban, CheckCircle2, CreditCard, Flag, Hourglass, TimerOff, XCircle,
} from 'lucide-react';
import type { ReservaStatus } from '@/types/supabase';

/**
 * Situação da reserva na visão do cliente — selo, ícone e cor da nota. Compartilhado entre a
 * lista (`/minhas-reservas`) e o detalhe (`/minhas-reservas/[id]`). Rótulo e nota no idioma do
 * site: `StatusReserva.<status>.label` / `.note`.
 */
export const STATUS: Record<
  ReservaStatus,
  { badge: string; Icon: React.ElementType; noteClass: string }
> = {
  pendente: {
    badge: 'bg-amber-100 text-amber-700',
    Icon: Hourglass,
    noteClass: 'bg-amber-50 border-amber-100 text-amber-700',
  },
  aguardando_pagamento: {
    badge: 'bg-violet-100 text-violet-700',
    Icon: CreditCard,
    noteClass: 'bg-violet-50 border-violet-100 text-violet-700',
  },
  expirada: {
    badge: 'bg-slate-200 text-slate-600',
    Icon: TimerOff,
    noteClass: 'bg-slate-50 border-slate-200 text-slate-500',
  },
  confirmada: {
    badge: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
    noteClass: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  },
  recusada: {
    badge: 'bg-red-100 text-red-600',
    Icon: XCircle,
    noteClass: 'bg-red-50 border-red-100 text-red-600',
  },
  cancelada: {
    badge: 'bg-slate-200 text-slate-600',
    Icon: Ban,
    noteClass: 'bg-slate-50 border-slate-200 text-slate-500',
  },
  concluida: {
    badge: 'bg-sky-100 text-sky-700',
    Icon: Flag,
    noteClass: 'bg-sky-50 border-sky-100 text-sky-700',
  },
};
