'use client';

import { useRouter } from 'next/navigation';
import SearchTypeToggle, { type SearchType } from '@/components/home/search/SearchTypeToggle';
import { useNavegacaoBusca } from '@/components/busca/NavegacaoBusca';
import { buildBuscarUrl, type BuscaSearchParams } from '../_lib/filtros';

/**
 * Abas Roteiros | Embarcações | Vendas das páginas de busca.
 * Roteiros ↔ Embarcações mantém os filtros em comum (destino, data, pessoas,
 * preço, duração, ordenação) e descarta os que só existem na outra aba
 * (modelo de cobrança é de roteiro; tipo e comodidades, de embarcação).
 * Vendas tem página e filtros próprios.
 */
export default function AbasBusca({ aba, params }: {
  aba: SearchType;
  /** Params de /buscar (ausente em /vendas). */
  params?: BuscaSearchParams;
}) {
  const router = useRouter();
  const { ir } = useNavegacaoBusca();

  function trocar(destino: SearchType) {
    if (destino === aba) return;
    if (destino === 'venda') return router.push('/vendas');
    const atuais = params ?? {};
    if (destino === 'embarcacao') {
      ir(buildBuscarUrl(atuais, { tipo: 'embarcacao', modelo_preco: null, pagina: null }));
    } else {
      ir(buildBuscarUrl(atuais, { tipo: null, tipo_embarcacao: null, tipo_nome: null, comodidades: null, pagina: null }));
    }
  }

  return <SearchTypeToggle value={aba} onChange={trocar} variant="light" />;
}
