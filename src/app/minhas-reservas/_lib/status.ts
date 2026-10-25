import {
  Ban, CheckCircle2, CreditCard, Flag, Hourglass, TimerOff, XCircle,
} from 'lucide-react';
import type { ReservaStatus } from '@/types/supabase';

/**
 * Situação da reserva na visão do cliente — rótulo, selo, ícone e nota. Compartilhado entre a
 * lista (`/minhas-reservas`) e o detalhe (`/minhas-reservas/[id]`).
 */
export const STATUS: Record<
  ReservaStatus,
  { label: string; badge: string; Icon: React.ElementType; note: string; noteClass: string }
> = {
  pendente: {
    label: 'Aguardando confirmação',
    badge: 'bg-amber-100 text-amber-700',
    Icon: Hourglass,
    note: 'Sua solicitação foi enviada. O gestor irá analisar e responder em breve.',
    noteClass: 'bg-amber-50 border-amber-100 text-amber-700',
  },
  aguardando_pagamento: {
    label: 'Aguardando pagamento',
    badge: 'bg-violet-100 text-violet-700',
    Icon: CreditCard,
    note: 'O gestor aceitou sua solicitação. Conclua o pagamento para garantir a data.',
    noteClass: 'bg-violet-50 border-violet-100 text-violet-700',
  },
  expirada: {
    label: 'Pagamento expirado',
    badge: 'bg-slate-200 text-slate-600',
    Icon: TimerOff,
    note: 'O prazo para pagamento terminou e a solicitação expirou. Nenhum valor foi cobrado.',
    noteClass: 'bg-slate-50 border-slate-200 text-slate-500',
  },
  confirmada: {
    label: 'Confirmada',
    badge: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
    note: 'Reserva confirmada pelo gestor.',
    noteClass: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  },
  recusada: {
    label: 'Recusada',
    badge: 'bg-red-100 text-red-600',
    Icon: XCircle,
    note: 'Esta solicitação foi recusada pelo gestor.',
    noteClass: 'bg-red-50 border-red-100 text-red-600',
  },
  cancelada: {
    label: 'Cancelada',
    badge: 'bg-slate-200 text-slate-600',
    Icon: Ban,
    note: 'Você cancelou esta reserva.',
    noteClass: 'bg-slate-50 border-slate-200 text-slate-500',
  },
  concluida: {
    label: 'Concluída',
    badge: 'bg-sky-100 text-sky-700',
    Icon: Flag,
    note: 'Experiência realizada. Conte como foi — sua avaliação ajuda outros clientes!',
    noteClass: 'bg-sky-50 border-sky-100 text-sky-700',
  },
};
