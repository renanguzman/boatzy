'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { registrarAuditoria } from '@/lib/financeiro/auditoria';
import type { FormaPagamentoCodigo } from '@/types/supabase';

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
    .update({ ativo: payload.ativo, parcelas_max: parcelasMax, valor_minimo_parcela: valorMinimo })
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

export type PrazosPayload = {
  horasPrazoPagamento: string;
  horasRepasseAposPasseio: string;
};

/** Prazo para o cliente pagar após o aceite e horas após o passeio para liberar o repasse. */
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
    .update({ horas_prazo_pagamento: prazo, horas_repasse_apos_passeio: repasse, atualizado_por: auth.userId })
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
