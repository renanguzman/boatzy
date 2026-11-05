import type { GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import type { ResumoRascunho } from '@/lib/rascunhos/armazenamento';
import {
  documentoDoRascunho, documentoParaRascunho, galeriaDoRascunho, galeriaParaRascunho,
  type DocumentoRascunho, type ImagemRascunho,
} from '@/lib/rascunhos/arquivos';
import type { RascunhosEmbarcacao } from './EtapaDocumentacao';

/**
 * Rascunho automático do cadastro/edição de embarcação (SPEC §107.5) — o que entra no
 * rascunho e como volta ao formulário. Usado por `NovaEmbarcacaoForm` e
 * `EditarEmbarcacaoForm`. Mudou o formato de `DadosRascunhoEmbarcacao`? Suba a versão.
 */

export const VERSAO_RASCUNHO_EMBARCACAO = 1;

export type DadosRascunhoEmbarcacao<F> = {
  form: F;
  regras: string[];
  equipamentos: string[];
  acessorios: string[];
  comodidades: string[];
  imagens: ImagemRascunho[];
  documentos: { inscricao: DocumentoRascunho | null; dpem: DocumentoRascunho | null };
  /** Cadastro novo: id gerado no 1º envio (pasta das fotos que já subiram). */
  novoId: string | null;
};

type EstadoEmbarcacao<F> = {
  form: F;
  regras: string[];
  equipamentos: string[];
  acessorios: string[];
  comodidades: string[];
  imagens: GaleriaItem[];
  documentos: RascunhosEmbarcacao;
  novoId?: string | null;
};

export function rascunhoDaEmbarcacao<F extends { nome: string }>(e: EstadoEmbarcacao<F>): {
  dados: DadosRascunhoEmbarcacao<F>; arquivos: Record<string, File>; resumo: ResumoRascunho;
} {
  const arquivos: Record<string, File> = {};
  const dados: DadosRascunhoEmbarcacao<F> = {
    form: e.form,
    regras: e.regras,
    equipamentos: e.equipamentos,
    acessorios: e.acessorios,
    comodidades: e.comodidades,
    imagens: galeriaParaRascunho(e.imagens, arquivos),
    documentos: {
      inscricao: documentoParaRascunho(e.documentos.inscricao, arquivos),
      dpem: documentoParaRascunho(e.documentos.dpem, arquivos),
    },
    novoId: e.novoId ?? null,
  };
  return { dados, arquivos, resumo: { titulo: e.form.nome.trim(), fotos: e.imagens.length } };
}

/**
 * Rascunho → estado do formulário. Itens que não existem mais (comodidade desativada,
 * foto apagada no servidor) ficam de fora; `perdidos` = arquivos não guardados.
 */
export function embarcacaoDoRascunho<F>(
  d: DadosRascunhoEmbarcacao<F>,
  arquivos: Map<string, File>,
  validos: { equipamentos: { id: string }[]; acessorios: { id: string }[]; comodidades: { id: string }[]; idsImagens?: Set<string> },
): EstadoEmbarcacao<F> & { perdidos: number } {
  const so = (ids: string[] | undefined, lista: { id: string }[]) => {
    const existentes = new Set(lista.map(i => i.id));
    return (ids ?? []).filter(id => existentes.has(id));
  };
  const galeria = galeriaDoRascunho(d.imagens, arquivos, validos.idsImagens);
  const inscricao = documentoDoRascunho(d.documentos?.inscricao, arquivos);
  const dpem = documentoDoRascunho(d.documentos?.dpem, arquivos);
  return {
    form: d.form,
    regras: d.regras ?? [],
    equipamentos: so(d.equipamentos, validos.equipamentos),
    acessorios: so(d.acessorios, validos.acessorios),
    comodidades: so(d.comodidades, validos.comodidades),
    imagens: galeria.itens,
    documentos: { inscricao: inscricao.documento, dpem: dpem.documento },
    novoId: d.novoId ?? null,
    perdidos: galeria.perdidas + Number(inscricao.perdido) + Number(dpem.perdido),
  };
}
