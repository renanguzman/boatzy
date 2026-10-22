'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { notificarSolicitanteDecisao } from '@/lib/emails/solicitacao-gestor';

type ActionResult = { ok: boolean; error?: string };

const ERROS: Record<string, string> = {
  apenas_admin: 'Acesso não autorizado.',
  solicitacao_inexistente: 'Pedido não encontrado.',
  solicitacao_ja_decidida: 'Este pedido já foi decidido por outro administrador.',
  observacao_obrigatoria: 'Escreva ao solicitante o motivo da recusa.',
};

/**
 * Aprova ou recusa um pedido de acesso de gestor. Aprovar concede o papel
 * `gestor` na mesma transação (`decidir_solicitacao_gestor`, SPEC §62) e o
 * solicitante é avisado por e-mail com a observação (a interna nunca vai).
 */
export async function decidirSolicitacaoGestor(input: {
  id: string;
  aprovar: boolean;
  observacao: string;
  observacaoInterna: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };
  if (!(await checkRoleInDb(user.id, ['admin']))) return { ok: false, error: ERROS.apenas_admin };

  const observacao = input.observacao.trim();
  const observacaoInterna = input.observacaoInterna.trim();
  if (!input.aprovar && !observacao) return { ok: false, error: ERROS.observacao_obrigatoria };
  if (observacao.length > 1000 || observacaoInterna.length > 1000) {
    return { ok: false, error: 'As observações podem ter no máximo 1000 caracteres.' };
  }

  const { error } = await supabaseAdmin.rpc('decidir_solicitacao_gestor', {
    p_id: input.id,
    p_aprovar: input.aprovar,
    p_admin_id: user.id,
    p_observacao: observacao || null,
    p_observacao_interna: observacaoInterna || null,
  });
  if (error) {
    const codigo = Object.keys(ERROS).find((k) => error.message.includes(k));
    return { ok: false, error: codigo ? ERROS[codigo] : 'Não foi possível salvar a decisão.' };
  }

  after(() => notificarSolicitanteDecisao({ solicitacaoId: input.id, aprovada: input.aprovar }));

  revalidatePath('/administrator', 'layout');
  return { ok: true };
}
