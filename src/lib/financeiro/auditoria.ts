import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { Json } from '@/types/supabase';

/**
 * Registra uma ação manual do admin no financeiro (`financeiro_auditoria`,
 * append-only). Chamar DEPOIS da alteração ter dado certo, com o estado
 * antes/depois. Falha ao auditar não desfaz a ação, mas é logada.
 */
export async function registrarAuditoria(input: {
  adminId: string;
  acao: string; // ex.: 'forma_pagamento.atualizar'
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  motivo?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('financeiro_auditoria').insert({
    admin_id: input.adminId,
    acao: input.acao,
    entidade: input.entidade,
    entidade_id: input.entidadeId ?? null,
    antes: (input.antes ?? null) as Json,
    depois: (input.depois ?? null) as Json,
    motivo: input.motivo?.trim() || null,
  });
  if (error) console.error('[financeiro/auditoria] falha ao registrar', input.acao, error.message);
}
