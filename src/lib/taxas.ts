import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

/**
 * Fallback de segurança — só usado se a RPC falhar por algum motivo
 * (nunca deveria acontecer, já que `taxa_plataforma` sempre tem 1 linha).
 * Mantém paridade com o valor vigente da taxa geral.
 */
const TAXA_FALLBACK = 12;

/**
 * Taxa efetiva (%) de um gestor: sua taxa específica (`usuario_taxa`), se
 * existir, estiver ativa e dentro da validade; senão, a taxa geral
 * (`taxa_plataforma`). Resolvida sempre pela função `get_taxa_usuario` do
 * banco (fonte da verdade — ver SPEC §14) — nunca hardcode esse valor.
 */
export async function getTaxaEfetiva(ownerId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('get_taxa_usuario', { p_user_id: ownerId });

  if (error || data == null) {
    console.error('[taxas] falha ao resolver taxa efetiva do gestor:', ownerId, error);
    return TAXA_FALLBACK;
  }

  return Number(data);
}

export type TaxaGeral = { id: string; taxaPercent: number; descricao: string | null };

/** Taxa geral vigente da plataforma (usada na tela `/administrator/taxas`). */
export async function getTaxaGeral(): Promise<TaxaGeral | null> {
  const { data } = await supabaseAdmin
    .from('taxa_plataforma')
    .select('id, taxa_percent, descricao')
    .eq('singleton', true)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, taxaPercent: Number(data.taxa_percent), descricao: data.descricao };
}
