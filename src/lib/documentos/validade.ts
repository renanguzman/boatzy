import { hojeISO } from '@/lib/datas';

/**
 * Situação de validade de um documento (SPEC §95.3) — mesma regra no painel,
 * no dashboard, no menu e no cron de avisos.
 */
export type SituacaoValidade = 'vencido' | 'vence_em_breve' | 'em_dia' | 'sem_validade';

/** A partir de quantos dias para o vencimento o documento fica "vence em breve". */
export const DIAS_ALERTA = 60;
/** Faixa de alerta no topo do painel: vencidos e os que vencem nestes dias. */
export const DIAS_FAIXA_TOPO = 30;
/** Marcos dos avisos (sino + e-mail): dias antes do vencimento; 0 = no dia. */
export const MARCOS_AVISO = [60, 30, 7, 0] as const;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Dias de `hoje` até `validade` (ambos 'AAAA-MM-DD'); negativo = já venceu. */
export function diasParaVencer(validade: string, hoje: string = hojeISO()): number {
  const [a1, m1, d1] = hoje.split('-').map(Number);
  const [a2, m2, d2] = validade.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS);
}

export function situacaoValidade(validade: string | null, hoje: string = hojeISO()): SituacaoValidade {
  if (!validade) return 'sem_validade';
  const dias = diasParaVencer(validade, hoje);
  if (dias < 0) return 'vencido';
  if (dias <= DIAS_ALERTA) return 'vence_em_breve';
  return 'em_dia';
}

/** Texto curto do prazo: "vence hoje", "vence em 12 dias", "venceu há 3 dias". */
export function textoPrazo(validade: string | null, hoje: string = hojeISO()): string {
  if (!validade) return 'sem validade';
  const dias = diasParaVencer(validade, hoje);
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${-dias} dias`;
}

/** Marco de aviso mais urgente já alcançado (60, 30, 7 ou 0) — null se ainda falta mais de 60 dias. */
export function marcoAviso(validade: string, hoje: string = hojeISO()): number | null {
  const dias = diasParaVencer(validade, hoje);
  let marco: number | null = null;
  for (const m of MARCOS_AVISO) if (dias <= m) marco = m;
  return marco;
}

/** Visual de cada situação (badges, contadores e faixa de alerta). */
export const VISUAL_SITUACAO: Record<
  SituacaoValidade | 'pendente',
  { rotulo: string; badge: string; ponto: string }
> = {
  vencido: { rotulo: 'Vencido', badge: 'bg-red-50 text-red-700 border-red-200', ponto: 'bg-red-500' },
  vence_em_breve: { rotulo: 'Vence em breve', badge: 'bg-amber-50 text-amber-700 border-amber-200', ponto: 'bg-amber-500' },
  em_dia: { rotulo: 'Em dia', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', ponto: 'bg-emerald-500' },
  sem_validade: { rotulo: 'Sem validade', badge: 'bg-slate-50 text-slate-600 border-slate-200', ponto: 'bg-slate-400' },
  pendente: { rotulo: 'Pendente', badge: 'bg-slate-50 text-slate-500 border-dashed border-slate-300', ponto: 'bg-slate-300' },
};

/** Contagem por situação (documentos ativos) + embarcações sem documento de inscrição. */
export type ResumoValidade = {
  vencidos: number;
  venceEmBreve: number;
  emDia: number;
  pendentes: number;
  /** Vencidos + os que vencem em até DIAS_FAIXA_TOPO dias (faixa do topo). */
  urgentes: number;
  total: number;
};
