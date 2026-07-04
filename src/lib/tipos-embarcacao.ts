import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

export type TipoEmbarcacaoOption = { id: string; nome: string };

/**
 * Tipos de embarcação disponíveis para a busca do site: apenas os que têm
 * pelo menos um roteiro ATIVO com embarcação daquele tipo vinculada (mesma
 * filosofia de /api/buscar/locais, que só devolve municípios com roteiro).
 */
export async function getTiposEmbarcacaoComRoteiro(): Promise<TipoEmbarcacaoOption[]> {
  const { data, error } = await supabaseAdmin
    .from('roteiro')
    .select('embarcacao ( embarcacao_tipo ( id, nome ) )')
    .eq('ativo', true)
    .not('embarcacao_id', 'is', null);

  if (error) {
    console.error('[tipos-embarcacao] falha ao carregar tipos:', error);
    return [];
  }

  const porId = new Map<string, TipoEmbarcacaoOption>();
  for (const row of (data ?? []) as unknown as {
    embarcacao: { embarcacao_tipo: TipoEmbarcacaoOption | null } | null;
  }[]) {
    const tipo = row.embarcacao?.embarcacao_tipo;
    if (tipo) porId.set(tipo.id, tipo);
  }

  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
