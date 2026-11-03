'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import { notificarAdminsRecebimentoAlterado } from '@/lib/emails/repasse';
import { validarRecebimento, type EntradaRecebimento, type ErrosRecebimento } from '@/lib/recebimento-tipos';

/**
 * Dados de recebimento do gestor (SPEC §101): onde o Boatzy deposita os repasses. Trocar não
 * apaga: o destino anterior fica no histórico (`ativo = false`) e a equipe é avisada por
 * e-mail a cada mudança. A gravação é a função SQL `salvar_gestor_recebimento` (atômica).
 */

export type SalvarRecebimentoResultado =
  | { ok: true; alterado: boolean }
  | { ok: false; error: string; campos?: ErrosRecebimento };

export async function salvarRecebimento(entrada: EntradaRecebimento): Promise<SalvarRecebimentoResultado> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo no painel.' };
  if (!(await checkRoleInDb(user.id, ['gestor', 'admin']))) return { ok: false, error: 'Acesso não autorizado.' };

  const validado = validarRecebimento(entrada);
  if (!validado.ok) {
    return { ok: false, error: Object.values(validado.erros)[0] ?? 'Confira os campos.', campos: validado.erros };
  }
  const dados = validado.dados;

  // Nada mudou: não cria linha nem avisa a equipe.
  const { data: atual } = await supabaseAdmin
    .from('gestor_recebimento')
    .select('tipo, pix_tipo_chave, pix_chave, banco_codigo, agencia, conta, conta_digito, tipo_conta, titular_nome, titular_documento')
    .eq('owner_id', user.id)
    .eq('ativo', true)
    .maybeSingle();
  if (atual && JSON.stringify(atual) === JSON.stringify({
    tipo: dados.tipo, pix_tipo_chave: dados.pix_tipo_chave, pix_chave: dados.pix_chave, banco_codigo: dados.banco_codigo,
    agencia: dados.agencia, conta: dados.conta, conta_digito: dados.conta_digito, tipo_conta: dados.tipo_conta,
    titular_nome: dados.titular_nome, titular_documento: dados.titular_documento,
  })) {
    return { ok: true, alterado: false };
  }

  const { data, error } = await supabaseAdmin.rpc('salvar_gestor_recebimento', { p_owner: user.id, p_dados: dados });
  if (error || !data) {
    console.error('[recebimentos] falha ao salvar:', error);
    return { ok: false, error: 'Não foi possível salvar agora. Tente novamente.' };
  }

  after(async () => {
    const { data: conta } = await supabaseAdmin.from('users').select('name').eq('id', user.id).maybeSingle();
    await notificarAdminsRecebimentoAlterado({
      ownerId: user.id,
      nome: conta?.name ?? dados.titular_nome,
      destino: dados,
      primeiraVez: !data.anterior_id,
      quando: new Date().toISOString(),
    });
  });

  revalidatePath('/painel');
  revalidatePath('/painel/recebimentos');
  revalidatePath('/painel/receitas');
  revalidatePath('/administrator/financeiro/repasses');
  return { ok: true, alterado: true };
}
