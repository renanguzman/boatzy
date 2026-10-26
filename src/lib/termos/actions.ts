'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { confereConfirmacao, definirConfirmacao } from './confirmacao';

/**
 * Confere, ainda na tela de aceite, se a confirmação digitada bate com o
 * cadastro do usuário logado — só para dar retorno imediato. A validação
 * que vale é refeita no servidor ao gravar o aceite (validarAceite).
 * O valor esperado nunca é enviado ao navegador.
 */
export async function conferirConfirmacaoDigitada(valor: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations('Termos');
  if (!user) return { ok: false, error: t('erros.sessaoExpirou') };

  const { data: usuario } = await supabaseAdmin
    .from('users')
    .select('name, cpf_cnpj')
    .eq('id', user.id)
    .maybeSingle();
  if (!usuario) return { ok: false, error: t('erros.usuarioNaoEncontrado') };

  const exigida = definirConfirmacao(usuario);
  if (!exigida) return { ok: true };

  return confereConfirmacao(exigida.tipo, valor.slice(0, 200), usuario)
    ? { ok: true }
    : { ok: false, error: t('erros.naoConfereCadastro', { rotulo: t(`rotuloConfirmacao.${exigida.tipo}`) }) };
}
