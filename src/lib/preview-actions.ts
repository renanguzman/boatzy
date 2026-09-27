'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRoleInDb } from '@/lib/roles';
import type { RoteiroDetalheDados } from '@/app/roteiros/[id]/_components/RoteiroDetalheView';

/**
 * Embarcação vinculada a um roteiro, no formato do bloco "Sobre a
 * Embarcação" da página pública — para a pré-visualização do roteiro no
 * painel. Mesmo embed de `/roteiros/[id]`. Gestor só enxerga as próprias
 * embarcações; admin, qualquer uma.
 */
export async function buscarEmbarcacaoParaPreview(
  embarcacaoId: string,
): Promise<RoteiroDetalheDados['embarcacao']> {
  if (!embarcacaoId) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const autorizado = await checkRoleInDb(user.id, ['gestor', 'admin']);
  if (!autorizado) return null;
  const isAdmin = await checkRoleInDb(user.id, ['admin']);

  let query = supabaseAdmin
    .from('embarcacao')
    .select(`
      nome, capacidade, comprimento, comprimento_unidade, quartos, tripulacao, modalidade_capitao,
      embarcacao_tipo ( nome ),
      embarcacao_comodidades ( comodidade ( nome ) ),
      embarcacao_imagens ( id, url_imagem, titulo, principal, ordem )
    `)
    .eq('id', embarcacaoId);
  if (!isAdmin) query = query.eq('owner_id', user.id);

  const { data } = await query.maybeSingle();
  return (data ?? null) as unknown as RoteiroDetalheDados['embarcacao'];
}
