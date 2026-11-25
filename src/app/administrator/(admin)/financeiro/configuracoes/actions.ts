'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { registrarAuditoria } from '@/lib/financeiro/auditoria';
import type { FormaPagamentoCodigo, GatewayPagamento } from '@/types/supabase';
import { lerPagarmeConfig } from '@/lib/pagarme/config';

type ActionResult = { ok: true } | { ok: false; error: string };

const CAMINHO = '/administrator/financeiro/configuracoes';

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const isAdmin = await checkRoleInDb(user.id, ['admin']);
  if (!isAdmin) return { ok: false, error: 'Acesso não autorizado.' };

  return { ok: true, userId: user.id };
}

/** Converte string do form em number|null, aceitando vírgula decimal. */
function paraNumero(v: string): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export type FormaPagamentoPayload = {
  codigo: FormaPagamentoCodigo;
  ativo: boolean;
  parcelasMax: number;
  valorMinimoParcela: string; // '' = sem mínimo
  /** Só no cartão: Pagar.me (padrão) ou Asaas (rollback) — SPEC §109. O Pix fica sempre no Asaas. */
  gateway?: GatewayPagamento;
};

/**
 * Liga/desliga uma forma de pagamento e, no cartão, define o parcelamento
 * global (parcelas máximas e valor mínimo por parcela). Vale para todos os
 * pedidos gerados a partir da alteração.
 */
export async function salvarFormaPagamento(payload: FormaPagamentoPayload): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: antes } = await supabaseAdmin
    .from('forma_pagamento')
    .select('*')
    .eq('codigo', payload.codigo)
    .maybeSingle();
  if (!antes) return { ok: false, error: 'Forma de pagamento não encontrada.' };

  const ehCartao = payload.codigo === 'cartao_credito';
  const parcelasMax = ehCartao ? Math.trunc(payload.parcelasMax) : 1;
  if (!Number.isFinite(parcelasMax) || parcelasMax < 1 || parcelasMax > 12) {
    return { ok: false, error: 'O parcelamento deve ser de 1x a 12x.' };
  }

  const valorMinimo = ehCartao ? paraNumero(payload.valorMinimoParcela) : null;
  if (valorMinimo !== null && valorMinimo <= 0) {
    return { ok: false, error: 'O valor mínimo por parcela deve ser maior que zero (ou vazio).' };
  }

  const gateway: GatewayPagamento = ehCartao && payload.gateway === 'pagarme' ? 'pagarme' : ehCartao && payload.gateway === 'asaas' ? 'asaas' : antes.gateway;
  if (gateway === 'pagarme' && antes.gateway !== 'pagarme' && !lerPagarmeConfig().ok) {
    return { ok: false, error: 'A Pagar.me não está configurada neste ambiente (variáveis PAGARME_*). Configure antes de ligar o cartão nela.' };
  }

  if (!payload.ativo && antes.ativo) {
    const { count } = await supabaseAdmin
      .from('forma_pagamento')
      .select('codigo', { count: 'exact', head: true })
      .eq('ativo', true)
      .neq('codigo', payload.codigo);
    if (!count) return { ok: false, error: 'Mantenha ao menos uma forma de pagamento ativa.' };
  }

  const { data: depois, error } = await supabaseAdmin
    .from('forma_pagamento')
    .update({ ativo: payload.ativo, parcelas_max: parcelasMax, valor_minimo_parcela: valorMinimo, gateway })
    .eq('codigo', payload.codigo)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };

  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'forma_pagamento.atualizar',
    entidade: 'forma_pagamento',
    entidadeId: payload.codigo,
    antes,
    depois,
  });

  revalidatePath(CAMINHO);
  return { ok: true };
}

/**
 * Tabela de juros do cartão (Pagar.me): acréscimo (%) sobre o valor à vista para
 * cada nº de parcelas, 100% pago pelo cliente (D-S5, SPEC §109). Vale para os
 * pagamentos feitos a partir da alteração.
 */
export async function salvarTabelaJuros(tabela: Record<number, string>): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const linhas: { parcelas: number; acrescimo_percentual: number; atualizado_por: string }[] = [];
  for (let n = 2; n <= 12; n++) {
    const bruto = tabela[n];
    const valor = bruto === undefined || bruto === '' ? 0 : paraNumero(String(bruto));
    if (valor === null || valor < 0 || valor > 100) {
      return { ok: false, error: `Acréscimo inválido em ${n}x: use um percentual de 0 a 100.` };
    }
    linhas.push({ parcelas: n, acrescimo_percentual: Math.round(valor * 1000) / 1000, atualizado_por: auth.userId });
  }
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i].acrescimo_percentual < linhas[i - 1].acrescimo_percentual) {
      return { ok: false, error: `O acréscimo de ${linhas[i].parcelas}x não pode ser menor que o de ${linhas[i - 1].parcelas}x.` };
    }
  }

  const { data: antes } = await supabaseAdmin.from('forma_pagamento_juros').select('parcelas, acrescimo_percentual').order('parcelas');
  const { error } = await supabaseAdmin.from('forma_pagamento_juros').upsert(linhas, { onConflict: 'parcelas' });
  if (error) return { ok: false, error: error.message };

  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'forma_pagamento.juros',
    entidade: 'forma_pagamento_juros',
    entidadeId: 'cartao_credito',
    antes,
    depois: linhas.map(({ parcelas, acrescimo_percentual }) => ({ parcelas, acrescimo_percentual })),
  });

  revalidatePath(CAMINHO);
  return { ok: true };
}

export type PrazosPayload = {
  exigirPagamento: boolean;
  horasPrazoPagamento: string;
  horasRepasseAposPasseio: string;
};

/**
 * Chave geral da cobrança no aceite, prazo para o cliente pagar após o aceite
 * e horas após o passeio para liberar o repasse.
 */
export async function salvarPrazosFinanceiro(payload: PrazosPayload): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const prazo = paraNumero(payload.horasPrazoPagamento);
  if (prazo === null || !Number.isInteger(prazo) || prazo < 1 || prazo > 168) {
    return { ok: false, error: 'O prazo para pagar deve ser um número inteiro de 1 a 168 horas.' };
  }
  const repasse = paraNumero(payload.horasRepasseAposPasseio);
  if (repasse === null || !Number.isInteger(repasse) || repasse < 0 || repasse > 720) {
    return { ok: false, error: 'As horas para o repasse devem ser um número inteiro de 0 a 720.' };
  }

  const { data: antes } = await supabaseAdmin.from('financeiro_config').select('*').eq('singleton', true).single();

  const { data: depois, error } = await supabaseAdmin
    .from('financeiro_config')
    .update({
      exigir_pagamento: payload.exigirPagamento,
      horas_prazo_pagamento: prazo,
      horas_repasse_apos_passeio: repasse,
      atualizado_por: auth.userId,
    })
    .eq('singleton', true)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };

  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'financeiro_config.atualizar',
    entidade: 'financeiro_config',
    entidadeId: depois.id,
    antes,
    depois,
  });

  revalidatePath(CAMINHO);
  return { ok: true };
}

export type CobrancaAvulsaPayload = {
  cobrarComissao: boolean;
  prazoPadraoHoras: string;
  prazoMaxDias: string;
  diasAposPasseio: string;
};

/**
 * Regras da cobrança avulsa do gestor (SPEC §34.16): se leva a taxa de serviço
 * da reserva, prazo padrão e máximo para pagar e até quantos dias depois do
 * passeio o gestor pode emitir. Vale para as cobranças emitidas daqui em diante.
 */
export async function salvarCobrancaAvulsa(payload: CobrancaAvulsaPayload): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const prazoMax = paraNumero(payload.prazoMaxDias);
  if (prazoMax === null || !Number.isInteger(prazoMax) || prazoMax < 1 || prazoMax > 60) {
    return { ok: false, error: 'O prazo máximo deve ser um número inteiro de 1 a 60 dias.' };
  }
  const prazoPadrao = paraNumero(payload.prazoPadraoHoras);
  if (prazoPadrao === null || !Number.isInteger(prazoPadrao) || prazoPadrao < 1 || prazoPadrao > prazoMax * 24) {
    return { ok: false, error: `O prazo padrão deve ser um número inteiro de 1 a ${prazoMax * 24} horas.` };
  }
  const janela = paraNumero(payload.diasAposPasseio);
  if (janela === null || !Number.isInteger(janela) || janela < 0 || janela > 365) {
    return { ok: false, error: 'Os dias após o passeio devem ser um número inteiro de 0 a 365.' };
  }

  const { data: antes } = await supabaseAdmin.from('financeiro_config').select('*').eq('singleton', true).single();

  const { data: depois, error } = await supabaseAdmin
    .from('financeiro_config')
    .update({
      avulso_cobrar_comissao: payload.cobrarComissao,
      avulso_prazo_padrao_horas: prazoPadrao,
      avulso_prazo_max_dias: prazoMax,
      avulso_dias_apos_passeio: janela,
      atualizado_por: auth.userId,
    })
    .eq('singleton', true)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };

  await registrarAuditoria({
    adminId: auth.userId,
    acao: 'financeiro_config.cobranca_avulsa',
    entidade: 'financeiro_config',
    entidadeId: depois.id,
    antes,
    depois,
  });

  revalidatePath(CAMINHO);
  return { ok: true };
}
