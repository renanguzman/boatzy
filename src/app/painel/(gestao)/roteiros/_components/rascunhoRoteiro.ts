import type { GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import type { ResumoRascunho } from '@/lib/rascunhos/armazenamento';
import { galeriaDoRascunho, galeriaParaRascunho, type ImagemRascunho } from '@/lib/rascunhos/arquivos';
import { janelaValida, type JanelaReservaMeses } from '@/lib/disponibilidade';
import type { RegraFormulario } from '@/lib/precos-calendario';
import type { ItemSelecionado } from './CatalogoSelector';

/**
 * Rascunho automático do cadastro/edição de roteiro (SPEC §107.5) — o que entra no
 * rascunho e como volta ao formulário. Usado por `NovoRoteiroForm` e
 * `EditarRoteiroForm`. Mudou o formato de `DadosRascunhoRoteiro`? Suba a versão.
 *
 * Nada aleatório na serialização (a edição compara com o estado inicial): paradas vão
 * só pelo nome, e o barco só pela diferença dos fechamentos em relação ao banco.
 */

export const VERSAO_RASCUNHO_ROTEIRO = 1;

export type RegraNovaRascunho = RegraFormulario & { localId: string };

/** Dias fechados do barco alterados neste cadastro (diferença em relação ao banco). */
export type FechamentosRascunho = { embarcacaoId: string; adicionar: string[]; remover: string[] };

export type DadosRascunhoRoteiro<F> = {
  form: F;
  cortesias: string[];
  paradas: string[];
  novaParada: string;
  regrasNovas: RegraNovaRascunho[];
  /** Edição: regras salvas marcadas para excluir. */
  regrasExcluir: string[];
  ajustes: Record<string, number>;
  diasOperacao: number[];
  janelaMeses: JanelaReservaMeses;
  diasRoteiro: Record<string, boolean>;
  fechamentosBarco: FechamentosRascunho | null;
  itensCatalogo: ItemSelecionado[];
  imagens: ImagemRascunho[];
  /** Cadastro novo: id gerado no 1º envio (pasta das fotos que já subiram). */
  novoId: string | null;
};

type EstadoRoteiro<F> = {
  form: F;
  cortesias: string[];
  paradas: { localId: string; nome: string }[];
  novaParada: string;
  regrasNovas: RegraNovaRascunho[];
  regrasExcluir: string[];
  ajustes: Record<string, number>;
  diasOperacao: number[];
  janelaMeses: JanelaReservaMeses;
  diasRoteiro: Record<string, boolean>;
  agendaBarco: { embarcacaoId: string; base: string[]; fechamentos: string[] };
  itensCatalogo: ItemSelecionado[];
  imagens: GaleriaItem[];
  novoId?: string | null;
};

export function rascunhoDoRoteiro<F extends { nome: string; embarcacao_id: string }>(e: EstadoRoteiro<F>): {
  dados: DadosRascunhoRoteiro<F>; arquivos: Record<string, File>; resumo: ResumoRascunho;
} {
  const arquivos: Record<string, File> = {};
  const a = e.agendaBarco;
  let fechamentosBarco: FechamentosRascunho | null = null;
  if (a.embarcacaoId && a.embarcacaoId === e.form.embarcacao_id) {
    const adicionar = a.fechamentos.filter(d => !a.base.includes(d)).sort();
    const remover = a.base.filter(d => !a.fechamentos.includes(d)).sort();
    if (adicionar.length > 0 || remover.length > 0) fechamentosBarco = { embarcacaoId: a.embarcacaoId, adicionar, remover };
  }
  const dados: DadosRascunhoRoteiro<F> = {
    form: e.form,
    cortesias: e.cortesias,
    paradas: e.paradas.map(p => p.nome),
    novaParada: e.novaParada,
    regrasNovas: e.regrasNovas,
    regrasExcluir: e.regrasExcluir,
    ajustes: e.ajustes,
    diasOperacao: e.diasOperacao,
    janelaMeses: e.janelaMeses,
    diasRoteiro: e.diasRoteiro,
    fechamentosBarco,
    itensCatalogo: e.itensCatalogo,
    imagens: galeriaParaRascunho(e.imagens, arquivos),
    novoId: e.novoId ?? null,
  };
  return { dados, arquivos, resumo: { titulo: e.form.nome.trim(), fotos: e.imagens.length } };
}

/** Fechamentos do barco no banco + diferença do rascunho. */
export function aplicarFechamentos(base: string[], f: FechamentosRascunho): string[] {
  const remover = new Set(f.remover);
  return [...base.filter(d => !remover.has(d)), ...f.adicionar.filter(d => !base.includes(d))];
}

/**
 * Rascunho → estado do formulário. Embarcação, extras e fotos que não existem mais
 * ficam de fora; `perdidos` = fotos novas sem o arquivo guardado.
 */
export function roteiroDoRascunho<F extends { embarcacao_id: string }>(
  d: DadosRascunhoRoteiro<F>,
  arquivos: Map<string, File>,
  validos: { embarcacoes: { id: string }[]; catalogo: { id: string }[]; idsImagens?: Set<string> },
): Omit<EstadoRoteiro<F>, 'agendaBarco'> & { fechamentosBarco: FechamentosRascunho | null; perdidos: number } {
  const embarcacaoOk = !d.form.embarcacao_id || validos.embarcacoes.some(e => e.id === d.form.embarcacao_id);
  const catalogo = new Set(validos.catalogo.map(c => c.id));
  const galeria = galeriaDoRascunho(d.imagens, arquivos, validos.idsImagens);
  return {
    form: embarcacaoOk ? d.form : { ...d.form, embarcacao_id: '' },
    cortesias: d.cortesias ?? [],
    paradas: (d.paradas ?? []).map(nome => ({ localId: crypto.randomUUID(), nome })),
    novaParada: d.novaParada ?? '',
    regrasNovas: d.regrasNovas ?? [],
    regrasExcluir: d.regrasExcluir ?? [],
    ajustes: d.ajustes ?? {},
    diasOperacao: d.diasOperacao ?? [],
    janelaMeses: janelaValida(d.janelaMeses),
    diasRoteiro: d.diasRoteiro ?? {},
    fechamentosBarco: embarcacaoOk ? d.fechamentosBarco ?? null : null,
    itensCatalogo: (d.itensCatalogo ?? []).filter(i => catalogo.has(i.catalogoId)),
    imagens: galeria.itens,
    novoId: d.novoId ?? null,
    perdidos: galeria.perdidas,
  };
}
