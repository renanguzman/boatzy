import type { ReservaStatus, ReservaTipo } from '@/types/supabase';

export const STATUS_LABEL: Record<ReservaStatus, string> = {
  pendente: 'Pendente',
  aguardando_pagamento: 'Aguardando pagamento',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
  expirada: 'Pagamento expirado',
};

export const STATUS_BADGE: Record<ReservaStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  aguardando_pagamento: 'bg-violet-100 text-violet-700',
  confirmada: 'bg-emerald-100 text-emerald-700',
  recusada: 'bg-red-100 text-red-600',
  cancelada: 'bg-slate-200 text-slate-600',
  concluida: 'bg-sky-100 text-sky-700',
  expirada: 'bg-slate-100 text-slate-500',
};

export const TIPO_LABEL: Record<ReservaTipo, string> = {
  roteiro: 'Roteiro',
  embarcacao: 'Embarcação',
};

// Base da receita: soma de total_estimado das reservas com estes status.
// Ampliável via filtro de status na tela, mas este é o default e o que
// alimenta o KPI principal quando nenhum filtro de status é aplicado.
export const STATUS_RECEITA: ReservaStatus[] = ['confirmada', 'concluida'];
