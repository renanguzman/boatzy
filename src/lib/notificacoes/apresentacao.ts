import {
  Ban,
  BadgeCheck,
  CalendarCheck,
  CircleAlert,
  Clock,
  CreditCard,
  Inbox,
  MessageCircle,
  RotateCcw,
  Star,
  TimerOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Database, NotificacaoTipo } from '@/types/supabase';

/** Central de notificações — apresentação compartilhada (sino do site, /notificacoes e sino do painel). */

export type Notificacao = Database['public']['Tables']['notificacao']['Row'];

type Visual = { icone: LucideIcon; cor: string; rotulo: string };

/** Ícone, cores do quadrado do ícone e rótulo do filtro por tipo. */
export const VISUAL_NOTIFICACAO: Record<NotificacaoTipo, Visual> = {
  reserva_solicitada: { icone: Inbox, cor: 'bg-amber-50 text-amber-600', rotulo: 'Nova solicitação' },
  reserva_confirmada: { icone: CalendarCheck, cor: 'bg-emerald-50 text-emerald-600', rotulo: 'Reserva confirmada' },
  reserva_recusada: { icone: XCircle, cor: 'bg-rose-50 text-rose-500', rotulo: 'Reserva não aceita' },
  reserva_cancelada: { icone: Ban, cor: 'bg-rose-50 text-rose-500', rotulo: 'Reserva cancelada' },
  reserva_expirada: { icone: TimerOff, cor: 'bg-amber-50 text-amber-600', rotulo: 'Prazo expirado' },
  reserva_concluida: { icone: Star, cor: 'bg-amber-50 text-amber-500', rotulo: 'Avalie seu passeio' },
  aguardando_pagamento: { icone: Clock, cor: 'bg-amber-50 text-amber-600', rotulo: 'Aguardando pagamento' },
  pagamento_aprovado: { icone: BadgeCheck, cor: 'bg-emerald-50 text-emerald-600', rotulo: 'Pagamento aprovado' },
  pagamento_recusado: { icone: CreditCard, cor: 'bg-rose-50 text-rose-500', rotulo: 'Pagamento recusado' },
  reembolso: { icone: RotateCcw, cor: 'bg-sky-50 text-sky-600', rotulo: 'Reembolso' },
  mensagem: { icone: MessageCircle, cor: 'bg-marinho/10 text-marinho', rotulo: 'Mensagem' },
};

export function visualNotificacao(tipo: string): Visual {
  return VISUAL_NOTIFICACAO[tipo as NotificacaoTipo] ?? { icone: CircleAlert, cor: 'bg-slate-100 text-slate-500', rotulo: 'Aviso' };
}

/**
 * Título gravado (pt-BR) — mensagens agrupadas mostram a contagem. É o texto dos avisos sem `dados`
 * (gestor, antigos); os do cliente são montados no idioma por `useTextoNotificacao`.
 */
export function tituloNotificacao(n: Pick<Notificacao, 'tipo' | 'titulo' | 'quantidade'>): string {
  if (n.tipo === 'mensagem' && n.quantidade > 1) {
    return n.titulo.replace(/^Nova mensagem de /, `${n.quantidade} novas mensagens de `);
  }
  return n.titulo;
}

