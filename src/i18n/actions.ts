'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { COOKIE_IDIOMA, OPCOES_COOKIE_IDIOMA, isIdioma } from './config';

export type AlterarIdiomaResult = { ok: true } | { ok: false; error: 'idioma_invalido' };

/**
 * Troca o idioma do site (seletor do Header). Grava o cookie `NEXT_LOCALE` e,
 * com usuário logado, `users.idioma` — assim a escolha acompanha a conta em
 * outros aparelhos (copiada para o cookie no login). Falha ao gravar o perfil
 * não impede a troca: o cookie já vale para este navegador.
 */
export async function alterarIdioma(idioma: string): Promise<AlterarIdiomaResult> {
  if (!isIdioma(idioma)) return { ok: false, error: 'idioma_invalido' };

  (await cookies()).set(COOKIE_IDIOMA, idioma, OPCOES_COOKIE_IDIOMA);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { error } = await supabaseAdmin.from('users').update({ idioma }).eq('id', user.id);
    if (error) console.error('[idioma] falha ao gravar users.idioma:', error);
  }

  return { ok: true };
}
