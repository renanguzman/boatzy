import {
  Ban,
  BadgeCheck,
  CalendarCheck,
  CircleAlert,
  Clock,
  CreditCard,
  MessageCircle,
  RotateCcw,
  Star,
  TimerOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { FUSO_HORARIO } from '@/lib/datas';
import type { Database, NotificacaoTipo } from '@/types/supabase';

/** Central de notificações do cliente — apresentação compartilhada (sino e /notificacoes). */

export type Notificacao = Database['public']['Tables']['notificacao']['Row'];

type Visual = { icone: LucideIcon; cor: string; rotulo: string };

/** Ícone, cores do quadrado do ícone e rótulo do filtro por tipo. */
export const VISUAL_NOTIFICACAO: Record<NotificacaoTipo, Visual> = {
  reserva_confirmada: { icone: CalendarCheck, cor: 'bg-emerald-50 text-emerald-600', rotulo: 'Reserva confirmada' },
  reserva_recusada: { icone: XCircle, cor: 'bg-rose-50 text-rose-500', rotulo: 'Reserva não aceita' },
  reserva_cancelada: { icone: Ban, cor: 'bg-rose-50 text-rose-500', rotulo: 'Reserva cancelada' },
  reserva_expirada: { icone: TimerOff, cor: 'bg-amber-50 text-amber-600', rotulo: 'Prazo expirado' },
  reserva_concluida: { icone: Star, cor: 'bg-amber-50 text-amber-500', rotulo: 'Avalie seu passeio' },
  aguardando_pagamento: { icone: Clock, cor: 'bg-amber-50 text-amber-600', rotulo: 'Aguardando pagamento' },
  pagamento_aprovado: { icone: BadgeCheck, cor: 'bg-emerald-50 text-emerald-600', rotulo: 'Pagamento aprovado' },
  pagamento_recusado: { icone: CreditCard, cor: 'bg-rose-50 text-rose-500', rotulo: 'Pagamento recusado' },
  reembolso: { icone: RotateCcw, cor: 'bg-sky-50 text-sky-600', rotulo: 'Reembolso' },
  mensagem: { icone: MessageCircle, cor: 'bg-[#0B3D91]/10 text-[#0B3D91]', rotulo: 'Mensagem' },
};

export function visualNotificacao(tipo: string): Visual {
  return VISUAL_NOTIFICACAO[tipo as NotificacaoTipo] ?? { icone: CircleAlert, cor: 'bg-slate-100 text-slate-500', rotulo: 'Aviso' };
}

/** Título exibido — mensagens agrupadas mostram a contagem. */
export function tituloNotificacao(n: Pick<Notificacao, 'tipo' | 'titulo' | 'quantidade'>): string {
  if (n.tipo === 'mensagem' && n.quantidade > 1) {
    return n.titulo.replace(/^Nova mensagem de /, `${n.quantidade} novas mensagens de `);
  }
  return n.titulo;
}

/** "agora", "há 5 min", "há 3 h", "há 2d" ou a data (dd/mm) após uma semana. */
export function quandoNotificacao(iso: string): string {
  const data = new Date(iso);
  const diffMin = Math.floor((Date.now() - data.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return data.toLocaleDateString('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit' });
}
