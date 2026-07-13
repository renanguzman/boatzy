import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import type { TipoVendaOption } from '@/components/home/search/venda/TipoVendaPicker';
import type { LocalVendaOption } from '@/components/home/search/venda/LocalidadeVendaPicker';

export type FiltrosVenda = {
  tipos: TipoVendaOption[];
  locais: LocalVendaOption[];
};

/**
 * Opções dos filtros da busca de Vendas: tipos de embarcação e localidades
 * (estado/cidade) que possuem pelo menos um anúncio ATIVO — mesma filosofia
 * do autocomplete de locais e do seletor de tipos (só ofertar o que existe).
 * A venda é de embarcação, então o filtro primário é o TIPO (Lancha, Iate…),
 * não a categoria (Passeio, Pesca…), que é orientada a passeio. Locais vêm da
 * RPC `vendas_locais`.
 */
export async function getFiltrosVenda(): Promise<FiltrosVenda> {
  const [{ data: locaisRows, error: locaisError }, { data: tipoRows, error: tipoError }] =
    await Promise.all([
      supabaseAdmin.rpc('vendas_locais'),
      supabaseAdmin
        .from('anuncio_venda')
        .select('embarcacao ( embarcacao_tipo ( id, nome ) )')
        .eq('status', 'ativo'),
    ]);

  if (locaisError) console.error('[vendas-filtros] falha em vendas_locais:', locaisError);
  if (tipoError) console.error('[vendas-filtros] falha ao carregar tipos:', tipoError);

  const locais: LocalVendaOption[] = (locaisRows ?? []).map((l) => ({
    estadoId: l.estado_id,
    estadoNome: l.estado_nome,
    uf: l.uf,
    municipioId: l.municipio_id,
    municipioNome: l.municipio_nome,
    total: Number(l.total),
  }));

  const porId = new Map<string, TipoVendaOption>();
  for (const row of (tipoRows ?? []) as unknown as {
    embarcacao: { embarcacao_tipo: TipoVendaOption | null } | null;
  }[]) {
    const tipo = row.embarcacao?.embarcacao_tipo;
    if (tipo) porId.set(tipo.id, tipo);
  }
  const tipos = [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { tipos, locais };
}
