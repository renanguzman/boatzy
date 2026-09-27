import type { GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import type { EmbarcacaoDetalheDados } from '@/app/embarcacoes/[id]/_components/EmbarcacaoDetalheView';
import type { RoteiroDetalheDados } from '@/app/roteiros/[id]/_components/RoteiroDetalheView';
import { normalizarTituloImagem } from '@/lib/galeria';
import { isComprimentoUnidade } from '@/lib/comprimento';
import type { PreviewDados } from './mensagens';
import type { CatalogoItem, ItemSelecionado } from '@/app/painel/(gestao)/roteiros/_components/CatalogoSelector';
import type { PrecoPessoaModoCapacidade } from '@/types/supabase';
import { duracaoParaHoras, duracaoTexto, type DuracaoUnidade } from '@/lib/duracao';

/**
 * Conversões do estado dos formulários do painel (strings, ids, arquivos
 * locais) para os dados das views públicas usados na pré-visualização.
 */

type Opcao = { id: string; nome: string };
type Estado = { id: number; uf: string; nome: string };
type Municipio = { id: number; nome: string };

/** "12" → 12; "" / inválido → null. Aceita vírgula decimal. */
export function numOuNull(v: string | null | undefined): number | null {
  const t = (v ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function textoOuNull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t || null;
}

/** Itens do editor de galeria → linhas de imagem (a posição é a ordem). */
export function imagensParaPreview(items: GaleriaItem[]) {
  return items.map((it, ordem) => ({
    id: it.key,
    url_imagem: it.url,
    titulo: normalizarTituloImagem(it.titulo),
    principal: it.principal,
    ordem,
  }));
}

/** Estado/município escolhidos → `municipios ( nome, estados ( uf, nome ) )`. */
export function municipioParaPreview(
  estados: Estado[], municipios: Municipio[], estadoId: string, municipioId: string,
): EmbarcacaoDetalheDados['municipios'] {
  const m = municipios.find(x => String(x.id) === municipioId);
  if (!m) return null;
  const e = estados.find(x => String(x.id) === estadoId);
  return { nome: m.nome, estados: e ? { uf: e.uf, nome: e.nome } : null };
}

/** Campos de endereço/coordenadas comuns a embarcação e roteiro. */
type EnderecoForm = {
  latitude: string; longitude: string;
  cep: string; bairro: string; logradouro: string; logradouro_numero: string; complemento: string;
};

function endereco(f: EnderecoForm) {
  return {
    latitude: numOuNull(f.latitude),
    longitude: numOuNull(f.longitude),
    cep: textoOuNull(f.cep.replace(/\D/g, '')),
    bairro: textoOuNull(f.bairro),
    logradouro: textoOuNull(f.logradouro),
    logradouro_numero: textoOuNull(f.logradouro_numero),
    complemento: textoOuNull(f.complemento),
  };
}

// ─── Embarcação ───────────────────────────────────────────────────────────────

export function montarPreviewEmbarcacao(args: {
  form: EnderecoForm & {
    nome: string; descricao: string; embarcacao_tipo_id: string; modalidade_capitao: string;
    capacidade: string; comprimento: string; comprimento_unidade: string;
    quartos: string; suites: string; banheiros: string; tripulacao: string; preco_base: string;
    estado_id: string; municipio_id: string;
  };
  tipos: Opcao[];
  estados: Estado[];
  municipios: Municipio[];
  comodidades: Opcao[];
  comodidadesSelecionadas: string[];
  imagens: GaleriaItem[];
  diasOperacao: number[];
  bloqueios: string[];
}): PreviewDados {
  const { form } = args;
  const tipo = args.tipos.find(t => t.id === form.embarcacao_tipo_id);
  return {
    tipo: 'embarcacao',
    datasBloqueadas: args.bloqueios,
    embarcacao: {
      id: 'preview',
      nome: form.nome.trim() || 'Nome da embarcação',
      descricao: textoOuNull(form.descricao),
      capacidade: numOuNull(form.capacidade),
      comprimento: numOuNull(form.comprimento),
      comprimento_unidade: isComprimentoUnidade(form.comprimento_unidade) ? form.comprimento_unidade : 'm',
      quartos: numOuNull(form.quartos),
      suites: numOuNull(form.suites),
      banheiros: numOuNull(form.banheiros),
      tripulacao: numOuNull(form.tripulacao),
      modalidade_capitao: form.modalidade_capitao,
      preco_base: numOuNull(form.preco_base),
      disponibilidade_dias_semana: args.diasOperacao.length > 0 ? args.diasOperacao : null,
      ...endereco(form),
      embarcacao_tipo: tipo ? { nome: tipo.nome } : null,
      municipios: municipioParaPreview(args.estados, args.municipios, form.estado_id, form.municipio_id),
      embarcacao_comodidades: args.comodidades
        .filter(c => args.comodidadesSelecionadas.includes(c.id))
        .map(c => ({ comodidade: { nome: c.nome } })),
      embarcacao_imagens: imagensParaPreview(args.imagens),
    },
  };
}

// ─── Roteiro ──────────────────────────────────────────────────────────────────

/**
 * Espelha as derivações de `criarRoteiro`/`atualizarRoteiro` (duração a partir
 * de valor+unidade, diária mínima ≥ 1, valores só quando o modelo está ativo),
 * para a prévia mostrar exatamente o que será salvo.
 */
export function montarPreviewRoteiro(args: {
  form: EnderecoForm & {
    nome: string; descricao: string; origem: string; destino: string;
    duracao_valor: string; duracao_unidade: DuracaoUnidade; quantidade_pessoas: string;
    preco_base: string;
    preco_diaria_ativo: boolean; preco_diaria_valor: string; preco_diaria_minimo: string;
    preco_pessoa_ativo: boolean; preco_pessoa_valor: string;
    preco_pessoa_capacidade_minima: string; preco_pessoa_capacidade_maxima: string;
    preco_pessoa_modo_capacidade: PrecoPessoaModoCapacidade;
    estado_id: string; municipio_id: string;
  };
  estados: Estado[];
  municipios: Municipio[];
  imagens: GaleriaItem[];
  diasOperacao: number[];
  bloqueios: string[];
  paradas: { nome: string }[];
  itensCatalogo: ItemSelecionado[];
  catalogo: CatalogoItem[];
  embarcacao: RoteiroDetalheDados['embarcacao'];
}): PreviewDados {
  const { form } = args;
  const inteiro = (v: string) => {
    const n = numOuNull(v);
    return n == null ? null : Math.trunc(n);
  };
  const roteiro: RoteiroDetalheDados = {
    id: 'preview',
    nome: form.nome.trim() || 'Nome do roteiro',
    descricao: form.descricao.trim(),
    origem: textoOuNull(form.origem),
    destino: textoOuNull(form.destino),
    duracao: duracaoTexto(duracaoParaHoras(form.duracao_valor, form.duracao_unidade)),
    quantidade_pessoas: inteiro(form.quantidade_pessoas),
    preco_base: numOuNull(form.preco_base),
    preco_diaria_ativo: form.preco_diaria_ativo,
    preco_diaria_valor: form.preco_diaria_ativo ? numOuNull(form.preco_diaria_valor) : null,
    preco_diaria_minimo: Math.max(1, inteiro(form.preco_diaria_minimo) ?? 1),
    preco_pessoa_ativo: form.preco_pessoa_ativo,
    preco_pessoa_valor: form.preco_pessoa_ativo ? numOuNull(form.preco_pessoa_valor) : null,
    preco_pessoa_capacidade_minima: inteiro(form.preco_pessoa_capacidade_minima),
    preco_pessoa_capacidade_maxima: form.preco_pessoa_ativo ? inteiro(form.preco_pessoa_capacidade_maxima) : null,
    preco_pessoa_modo_capacidade: form.preco_pessoa_modo_capacidade,
    disponibilidade_dias_semana: args.diasOperacao.length > 0 ? args.diasOperacao : null,
    ...endereco(form),
    municipios: municipioParaPreview(args.estados, args.municipios, form.estado_id, form.municipio_id),
    roteiro_imagens: imagensParaPreview(args.imagens),
    embarcacao: args.embarcacao,
    roteiro_parada: args.paradas.filter(p => p.nome.trim()).map(p => ({ nome: p.nome.trim() })),
    roteiro_catalogo: args.itensCatalogo.flatMap(item => {
      const c = args.catalogo.find(x => x.id === item.catalogoId);
      if (!c) return [];
      return [{
        id: item.catalogoId,
        valor_customizado: numOuNull(item.valorCustomizado),
        catalogo: { id: c.id, descricao: c.descricao, valor: c.valor, tipo: c.tipo },
      }];
    }),
  };
  return { tipo: 'roteiro', datasBloqueadas: args.bloqueios, roteiro };
}
