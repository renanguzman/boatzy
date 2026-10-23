'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registra uma escolha de cookies como evidência (LGPD — SPEC §66). Liga ao
 * usuário quando há sessão. Nunca lança: falha só é logada (a escolha já
 * vale no navegador).
 */
export async function registrarConsentimento(input: {
  visitanteId: string;
  medicao: boolean;
  versaoPolitica: string;
  origem: 'banner' | 'minha_conta';
}): Promise<void> {
  try {
    if (!UUID.test(input.visitanteId)) return;
    if (input.origem !== 'banner' && input.origem !== 'minha_conta') return;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userAgent = (await headers()).get('user-agent')?.slice(0, 400) ?? null;

    const { error } = await supabaseAdmin.from('consentimento_cookies').insert({
      visitante_id: input.visitanteId,
      user_id: user?.id ?? null,
      medicao: input.medicao === true,
      versao_politica: input.versaoPolitica.slice(0, 40),
      origem: input.origem,
      user_agent: userAgent,
    });
    if (error) console.error('[consentimento] falha ao registrar', error.message);
  } catch (err) {
    console.error('[consentimento] falha ao registrar', err instanceof Error ? err.message : err);
  }
}
