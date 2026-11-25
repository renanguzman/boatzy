import type { RepasseMetodo, SituacaoRepasse } from '@/types/supabase';

/** Rótulos do repasse, compartilhados entre o admin e o painel do gestor (SPEC §101). */

type Rotulo = { label: string; cls: string };

/** Visão da equipe Boatzy: cada etapa que separa o pagamento do repasse. */
export const SITUACAO_ADMIN: Record<SituacaoRepasse, Rotulo & { dica: string }> = {
  a_repassar: { label: 'A repassar', cls: 'bg-emerald-50 text-emerald-700', dica: 'Liberado: já pode ser pago ao gestor.' },
  aguardando_prazo: { label: 'Aguardando prazo', cls: 'bg-sky-50 text-sky-700', dica: 'Passeio realizado; dentro do prazo de espera antes do repasse.' },
  aguardando_passeio: { label: 'Aguardando passeio', cls: 'bg-slate-100 text-slate-600', dica: 'Pago, mas o passeio ainda não aconteceu.' },
  aguardando_recebimento: {
    label: 'Aguardando liquidação',
    cls: 'bg-amber-50 text-amber-700',
    dica: 'Pago pelo cliente, mas o gateway ainda não liquidou o valor (Pix no Asaas; cartão na Stone/Pagar.me, com antecipação automática — ou no Asaas, ~D+32, nos cartões antigos).',
  },
  retido: { label: 'Retido', cls: 'bg-red-50 text-red-700', dica: 'Disputa, reembolso parcial ou reserva encerrada: não repassar sem conferir.' },
  reembolsado: { label: 'Reembolsado', cls: 'bg-amber-100 text-amber-800', dica: 'Pagamento devolvido ao cliente: nada a repassar.' },
  repassado: { label: 'Repassado', cls: 'bg-teal-50 text-teal-700', dica: 'Já incluído em um repasse pago.' },
};

/** Visão do gestor: mais simples, sem falar de gateway. */
export const SITUACAO_GESTOR: Record<SituacaoRepasse, Rotulo> = {
  a_repassar: { label: 'Liberado para repasse', cls: 'bg-emerald-50 text-emerald-700' },
  aguardando_prazo: { label: 'Liberação em breve', cls: 'bg-sky-50 text-sky-700' },
  aguardando_passeio: { label: 'Aguardando o passeio', cls: 'bg-slate-100 text-slate-600' },
  aguardando_recebimento: { label: 'Aguardando compensação', cls: 'bg-amber-50 text-amber-700' },
  retido: { label: 'Em análise', cls: 'bg-red-50 text-red-700' },
  reembolsado: { label: 'Reembolsado', cls: 'bg-amber-100 text-amber-800' },
  repassado: { label: 'Pago', cls: 'bg-teal-50 text-teal-700' },
};

export const METODO_REPASSE: Record<RepasseMetodo, string> = { pix: 'Pix', ted: 'TED', doc: 'DOC', outro: 'Outro' };

export const METODOS_REPASSE = Object.keys(METODO_REPASSE) as RepasseMetodo[];

/** Rótulo de cada ação de repasse na trilha de auditoria. */
export const ACAO_REPASSE: Record<string, string> = {
  'repasse.registrar': 'Repasse registrado',
  'repasse.cancelar': 'Repasse cancelado',
  'repasse.comprovante': 'Comprovante anexado',
};

/**
 * Nome do gateway que processou o pagamento (SPEC §109): Pix sempre no Asaas;
 * cartão na Stone/Pagar.me (ou no Asaas, nos pagamentos antigos / em rollback).
 */
export const GATEWAY_LABEL = { asaas: 'Asaas', pagarme: 'Stone/Pagar.me' } as const;
export type GatewayNome = keyof typeof GATEWAY_LABEL;
