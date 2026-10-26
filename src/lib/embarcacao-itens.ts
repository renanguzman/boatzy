import type { CategoriaEquipamentos } from '@/components/boat/EquipamentosEmbarcacao';

/** Joins de itens da embarcação, no formato em que as páginas públicas os selecionam. */
type ItensEmbarcacao = {
  embarcacao_equipamentos_seguranca: { equipamentos_seguranca: { nome: string } | null }[];
  embarcacao_acessorios: { acessorios: { nome: string } | null }[];
  embarcacao_comodidades: { comodidade: { nome: string } | null }[];
};

/**
 * As três categorias do bloco "O que esta embarcação possui" (`EquipamentosEmbarcacao`), na ordem
 * de exibição, ignorando joins sem item. Usado no detalhe do roteiro e na página da embarcação.
 * Título e contagem de cada categoria ficam nas mensagens (`Embarcacao.categorias.<icone>`).
 */
export function categoriasDaEmbarcacao(e: ItensEmbarcacao): CategoriaEquipamentos[] {
  return [
    {
      icone: 'seguranca',
      itens: e.embarcacao_equipamentos_seguranca.flatMap((ee) => (ee.equipamentos_seguranca ? [ee.equipamentos_seguranca.nome] : [])),
    },
    {
      icone: 'acessorios',
      itens: e.embarcacao_acessorios.flatMap((ea) => (ea.acessorios ? [ea.acessorios.nome] : [])),
    },
    {
      icone: 'comodidades',
      itens: e.embarcacao_comodidades.flatMap((ec) => (ec.comodidade ? [ec.comodidade.nome] : [])),
    },
  ];
}
