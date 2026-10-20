import type { GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import type { RoteiroDetalheDados } from '@/app/roteiros/[id]/_components/RoteiroDetalheView';
import { normalizarTituloImagem } from '@/lib/galeria';
import { isComprimentoUnidade } from '@/lib/comprimento';
import type { PreviewDados } from './mensagens';
import { dataMaximaReservaISO, hojeISO } from '@/lib/datas';
import { ajustesComoRegras, resolverPrecoNaData, somarDiasISO, type RegraPreco } from '@/lib/precos-calendario';
import { calendarioClienteLocal, DIAS_APOS_JANELA, type CalendarioCliente, type OcupacaoDia } from '@/lib/disponibilidade';
import type { CatalogoItem, ItemSelecionado } from '@/app/painel/(gestao)/roteiros/_components/CatalogoSelector';
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
): { nome: string; estados: { uf: string; nome: string } | null } | null {
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
  form: {
    nome: string; descricao: string; embarcacao_tipo_id: string;
    capacidade: string; comprimento: string; comprimento_unidade: string;
    quartos: string; banheiros: string; tripulacao: string;
    estado_id: string; municipio_id: string;
  };
  tipos: Opcao[];
  estados: Estado[];
  municipios: Municipio[];
  comodidades: Opcao[];
  comodidadesSelecionadas: string[];
  equipamentosSeguranca: Opcao[];
  equipamentosSegurancaSelecionados: string[];
  acessorios: Opcao[];
  acessoriosSelecionados: string[];
  imagens: GaleriaItem[];
}): PreviewDados {
  const { form } = args;
  const tipo = args.tipos.find(t => t.id === form.embarcacao_tipo_id);
  return {
    tipo: 'embarcacao',
    embarcacao: {
      id: 'preview',
      nome: form.nome.trim() || 'Nome da embarcação',
      descricao: textoOuNull(form.descricao),
      capacidade: numOuNull(form.capacidade),
      comprimento: numOuNull(form.comprimento),
      comprimento_unidade: isComprimentoUnidade(form.comprimento_unidade) ? form.comprimento_unidade : 'm',
      quartos: numOuNull(form.quartos),
      banheiros: numOuNull(form.banheiros),
      tripulacao: numOuNull(form.tripulacao),
      embarcacao_tipo: tipo ? { nome: tipo.nome } : null,
      municipios: municipioParaPreview(args.estados, args.municipios, form.estado_id, form.municipio_id),
      embarcacao_comodidades: args.comodidades
        .filter(c => args.comodidadesSelecionadas.includes(c.id))
        .map(c => ({ comodidade: { nome: c.nome } })),
      embarcacao_equipamentos_seguranca: args.equipamentosSeguranca
        .filter(e => args.equipamentosSegurancaSelecionados.includes(e.id))
        .map(e => ({ equipamentos_seguranca: { nome: e.nome } })),
      embarcacao_acessorios: args.acessorios
        .filter(a => args.acessoriosSelecionados.includes(a.id))
        .map(a => ({ acessorios: { nome: a.nome } })),
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
/** Agenda do formulário de roteiro (preço + disponibilidade) ainda não salva. */
export type AgendaPreview = {
  diasOperacao: number[];
  janelaMeses: number;
  diasRoteiro: Record<string, boolean>;
  fechamentosBarco: string[] | null;
  ocupacao: OcupacaoDia[];
  regras: RegraPreco[];
  ajustes: Record<string, number>;
  taxaPercent: number;
};

/**
 * Calendário que o cliente verá (situação + preço + total com a taxa de cada
 * dia), calculado no navegador com o que ainda não foi salvo — espelho de
 * `roteiro_calendario`. Usado pela prévia da página e pelo card da Revisão.
 */
export function calendarioPreview(precoBase: number | null, a: AgendaPreview): CalendarioCliente {
  const hoje = hojeISO();
  const dataMaxima = dataMaximaReservaISO(a.janelaMeses, hoje);
  const regrasDoDia = [...a.regras, ...ajustesComoRegras(a.ajustes)];
  return calendarioClienteLocal({
    agenda: {
      hoje, dataMaxima, diasOperacao: a.diasOperacao, diasRoteiro: a.diasRoteiro,
      barcoFechado: new Set(a.fechamentosBarco ?? []),
      ocupadas: new Set(a.ocupacao.map(o => o.data)),
    },
    precoDoDia: iso => resolverPrecoNaData(precoBase, regrasDoDia, iso).valor,
    taxaPercent: a.taxaPercent,
    ate: somarDiasISO(dataMaxima, DIAS_APOS_JANELA),
  });
}

export function montarPreviewRoteiro(args: {
  form: EnderecoForm & {
    nome: string; descricao: string; origem: string; destino: string;
    duracao_valor: string; duracao_unidade: DuracaoUnidade; quantidade_pessoas: string;
    preco_base: string;
    preco_diaria_ativo: boolean; preco_diaria_valor: string; preco_diaria_minimo: string;
    horario_saida: string;
    estado_id: string; municipio_id: string;
  };
  estados: Estado[];
  municipios: Municipio[];
  imagens: GaleriaItem[];
  paradas: { nome: string }[];
  /** Calendário do cliente com o que ainda não foi salvo (preço + disponibilidade). */
  agenda: AgendaPreview;
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
    duracao_horas: duracaoParaHoras(form.duracao_valor, form.duracao_unidade),
    quantidade_pessoas: inteiro(form.quantidade_pessoas),
    preco_base: numOuNull(form.preco_base),
    preco_diaria_ativo: form.preco_diaria_ativo,
    preco_diaria_valor: form.preco_diaria_ativo ? numOuNull(form.preco_diaria_valor) : null,
    preco_diaria_minimo: Math.max(1, inteiro(form.preco_diaria_minimo) ?? 1),
    disponibilidade_dias_semana: args.agenda.diasOperacao.length > 0 ? args.agenda.diasOperacao : null,
    horario_saida: textoOuNull(form.horario_saida),
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
  return { tipo: 'roteiro', calendario: calendarioPreview(roteiro.preco_base, args.agenda), roteiro };
}
