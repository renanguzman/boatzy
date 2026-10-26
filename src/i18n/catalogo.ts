/**
 * Nomes dos catálogos (tipo de embarcação, comodidade, acessório, equipamento de segurança) no
 * idioma do site (SPEC §94.12). O banco guarda `nome` (pt-BR) e `nome_en`/`nome_es`; o site
 * traduz pelo `nome`, que continua sendo a chave nas telas e nas URLs. Sem tradução → pt-BR.
 * Sem dependências de servidor: usado por `catalogo-servidor.ts` e pelo contexto de cliente.
 */

export const CATEGORIAS_CATALOGO = ['tipo', 'comodidade', 'acessorio', 'equipamento'] as const;

export type CategoriaCatalogo = (typeof CATEGORIAS_CATALOGO)[number];

/** Dicionário `nome em pt-BR → nome no idioma`, por categoria. Vazio em pt-BR. */
export type DadosCatalogo = Record<CategoriaCatalogo, Record<string, string>>;

export const CATALOGO_VAZIO: DadosCatalogo = { tipo: {}, comodidade: {}, acessorio: {}, equipamento: {} };

/** Tabela e coluna de cada categoria. */
export const TABELA_CATALOGO = {
  tipo: 'embarcacao_tipo',
  comodidade: 'comodidade',
  acessorio: 'acessorios',
  equipamento: 'equipamentos_seguranca',
} as const satisfies Record<CategoriaCatalogo, string>;

export type TradutorCatalogo = (categoria: CategoriaCatalogo, nome: string) => string;

export function criarTradutorCatalogo(dados: DadosCatalogo): TradutorCatalogo {
  return (categoria, nome) => dados[categoria][nome] ?? nome;
}

/** Ordena itens pelo nome traduzido (`localeCompare` do idioma), mantendo o `nome` pt-BR. */
export function ordenarPorCatalogo<T extends { nome: string }>(
  itens: T[],
  categoria: CategoriaCatalogo,
  traduzir: TradutorCatalogo,
  localeIntl: string,
): T[] {
  return [...itens].sort((a, b) => traduzir(categoria, a.nome).localeCompare(traduzir(categoria, b.nome), localeIntl));
}
