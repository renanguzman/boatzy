import type { EmbarcacaoOption } from './AnuncioForm';

/** Linha do select de embarcação usado pelas páginas novo/editar. */
export type EmbarcacaoRow = {
  id: string;
  nome: string;
  capacidade: number | null;
  embarcacao_tipo: { id: string; nome: string } | null;
  municipios: { nome: string; estados: { uf: string } | null } | null;
  embarcacao_imagens: { url_imagem: string; principal: boolean }[];
};

export function toOption(e: EmbarcacaoRow): EmbarcacaoOption {
  const img = (e.embarcacao_imagens.find((i) => i.principal) ?? e.embarcacao_imagens[0])?.url_imagem ?? null;
  return {
    id: e.id,
    nome: e.nome,
    capacidade: e.capacidade,
    tipo: e.embarcacao_tipo,
    localidade: e.municipios
      ? (e.municipios.estados ? `${e.municipios.nome} / ${e.municipios.estados.uf}` : e.municipios.nome)
      : null,
    imagem: img,
  };
}

export const EMBARCACAO_OPTION_SELECT = `
  id,
  nome,
  capacidade,
  embarcacao_tipo ( id, nome ),
  municipios ( nome, estados ( uf ) ),
  embarcacao_imagens ( url_imagem, principal )
`;
