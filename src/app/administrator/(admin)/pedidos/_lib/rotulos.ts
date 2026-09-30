/** Rótulos e cores do módulo Pedidos (admin) — compartilhados entre lista e detalhe. */

import type {
  AsaasWebhookEventoStatus,
  FormaPagamentoCodigo,
  PagamentoEstornoStatus,
  PagamentoParcelaStatus,
  PagamentoStatus,
  PedidoStatus,
  ReservaStatus,
} from '@/types/supabase';

type Rotulo = { label: string; cls: string };

export const PEDIDO_STATUS: Record<PedidoStatus, Rotulo> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', cls: 'bg-violet-50 text-violet-700' },
  pago: { label: 'Pago', cls: 'bg-emerald-50 text-emerald-700' },
  expirado: { label: 'Expirado', cls: 'bg-slate-100 text-slate-500' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  reembolsado: { label: 'Reembolsado', cls: 'bg-amber-50 text-amber-700' },
  reembolsado_parcial: { label: 'Reembolso parcial', cls: 'bg-amber-50 text-amber-700' },
  em_disputa: { label: 'Em disputa', cls: 'bg-red-50 text-red-700' },
};

export const PAGAMENTO_STATUS: Record<PagamentoStatus, Rotulo> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' },
  em_analise: { label: 'Em análise', cls: 'bg-sky-50 text-sky-700' },
  confirmado: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700' },
  recebido: { label: 'Recebido', cls: 'bg-emerald-100 text-emerald-800' },
  recusado: { label: 'Recusado', cls: 'bg-red-50 text-red-700' },
  vencido: { label: 'Vencido', cls: 'bg-slate-100 text-slate-500' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  estorno_em_andamento: { label: 'Estorno em andamento', cls: 'bg-amber-50 text-amber-700' },
  estornado: { label: 'Estornado', cls: 'bg-amber-100 text-amber-800' },
  estornado_parcial: { label: 'Estorno parcial', cls: 'bg-amber-50 text-amber-700' },
  em_disputa: { label: 'Em disputa (chargeback)', cls: 'bg-red-50 text-red-700' },
};

export const PARCELA_STATUS: Record<PagamentoParcelaStatus, Rotulo> = {
  pendente: PAGAMENTO_STATUS.pendente,
  confirmado: PAGAMENTO_STATUS.confirmado,
  recebido: PAGAMENTO_STATUS.recebido,
  cancelado: PAGAMENTO_STATUS.cancelado,
  estornado: PAGAMENTO_STATUS.estornado,
  em_disputa: PAGAMENTO_STATUS.em_disputa,
};

export const ESTORNO_STATUS: Record<PagamentoEstornoStatus, Rotulo> = {
  solicitado: { label: 'Solicitado', cls: 'bg-amber-50 text-amber-700' },
  em_andamento: { label: 'Em andamento', cls: 'bg-sky-50 text-sky-700' },
  concluido: { label: 'Concluído', cls: 'bg-emerald-50 text-emerald-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
};

export const RESERVA_STATUS: Record<ReservaStatus, Rotulo> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' },
  aguardando_pagamento: { label: 'Aguardando pagamento', cls: 'bg-violet-50 text-violet-700' },
  confirmada: { label: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700' },
  recusada: { label: 'Recusada', cls: 'bg-red-50 text-red-700' },
  cancelada: { label: 'Cancelada pelo cliente', cls: 'bg-slate-100 text-slate-500' },
  concluida: { label: 'Concluída', cls: 'bg-sky-50 text-sky-700' },
  expirada: { label: 'Pagamento expirado', cls: 'bg-slate-100 text-slate-500' },
};

export const EVENTO_STATUS: Record<AsaasWebhookEventoStatus, Rotulo> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700' },
  processando: { label: 'Processando', cls: 'bg-blue-50 text-blue-700' },
  processado: { label: 'Processado', cls: 'bg-emerald-50 text-emerald-700' },
  ignorado: { label: 'Ignorado', cls: 'bg-slate-100 text-slate-500' },
  erro: { label: 'Erro', cls: 'bg-red-50 text-red-700' },
};

export const FORMA_LABEL: Record<FormaPagamentoCodigo, string> = {
  pix: 'Pix',
  cartao_credito: 'Cartão de crédito',
};

export const MODALIDADE_LABEL: Record<string, string> = {
  roteiro: 'Roteiro (diária única)',
  diaria: 'Por diária',
  pessoa: 'Por pessoa',
};

/** Tipos de movimento em `pagamento_transacao` (ver src/lib/pagamentos/webhook.ts). */
export const TRANSACAO_LABEL: Record<string, string> = {
  criacao: 'Cobrança criada',
  falha_criacao: 'Falha ao criar a cobrança',
  atualizacao: 'Cobrança atualizada',
  autorizacao: 'Autorizada no cartão',
  analise_risco: 'Em análise de risco',
  aprovado_analise_risco: 'Aprovada na análise de risco',
  recusa: 'Recusada',
  confirmacao: 'Pagamento confirmado',
  recebimento: 'Pagamento recebido (saldo disponível)',
  antecipacao: 'Antecipada',
  vencimento: 'Vencida',
  cancelamento: 'Cobrança removida',
  restauracao: 'Cobrança restaurada',
  estorno_em_andamento: 'Estorno em andamento',
  estorno: 'Estornada',
  estorno_parcial: 'Estorno parcial',
  chargeback: 'Chargeback solicitado',
  chargeback_disputa: 'Chargeback em disputa',
  chargeback_revertido: 'Chargeback revertido (aguardando repasse)',
};

/** Ações do admin em `financeiro_auditoria` (entidade 'pedido'). */
export const ACAO_LABEL: Record<string, string> = {
  'pedido.sincronizar': 'Sincronizou com o Asaas',
  'pedido.prorrogar': 'Prorrogou o prazo de pagamento',
  'pedido.expirar': 'Expirou o pedido manualmente',
  'pedido.reenviar_email': 'Reenviou e-mail ao cliente',
  'pedido.anotacao': 'Anotação interna',
  'pagamento.cancelar': 'Cancelou uma cobrança pendente',
};

/** CPF/CNPJ só dígitos → formatado. */
export function formatarDocumento(doc: string | null | undefined): string {
  const d = (doc ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc || '—';
}

/** Telefone só dígitos → (00) 00000-0000. */
export function formatarTelefone(tel: string | null | undefined): string {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return tel || '—';
}

export function formatarDataCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
}
