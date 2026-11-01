import type { EtapaDef } from '@/components/painel/etapas/IndicadorEtapas';
import type { ItemRevisao } from '@/components/painel/etapas/RevisaoChecklist';
import type { GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import type { EmbarcacaoCardData } from '@/components/ui/EmbarcacaoCard';
import { formatarComprimento } from '@/lib/comprimento';
import { FOTOS_RECOMENDADAS } from '@/lib/upload';
import { TIPOS_DOCUMENTO } from '@/lib/documentos/tipos';
import { situacaoValidade, type SituacaoValidade } from '@/lib/documentos/validade';
import { erroConferencia, type DocumentoAtual, type RascunhoDocumento } from '@/lib/documentos/rascunho';

/**
 * Etapas do cadastro/edição de embarcação (`NovaEmbarcacaoForm` e
 * `EditarEmbarcacaoForm`). O índice é usado pelos forms para mostrar cada
 * grupo de seções — manter a ordem em sincronia com eles.
 */
export const ETAPAS_EMBARCACAO: EtapaDef[] = [
  { id: 'informacoes',     label: 'Informações',     desc: 'Nome, tipo e capitão' },
  { id: 'detalhes',        label: 'Detalhes',        desc: 'Especificações e comodidades' },
  { id: 'localizacao',     label: 'Localização',     desc: 'Onde ela fica' },
  { id: 'fotos',           label: 'Fotos',           desc: 'Galeria e títulos' },
  { id: 'documentacao',    label: 'Documentos',      desc: 'TIE e seguro DPEM' },
  { id: 'revisao',         label: 'Revisão',         desc: 'Conferir e salvar' },
];

export const ETAPA_EMB = {
  informacoes: 0, detalhes: 1, localizacao: 2, fotos: 3, documentacao: 4, revisao: 5,
} as const;

/** Documento da etapa Documentos como a Revisão o resume: a enviar (rascunho) ou o ativo salvo. */
export type DocRevisao = { sigla: string; estado: 'novo' | SituacaoValidade; erro: string | null };

export function docRevisao(rascunho: RascunhoDocumento | null, atual: DocumentoAtual | null | undefined): DocRevisao | null {
  if (rascunho) {
    const sigla = TIPOS_DOCUMENTO[rascunho.tipo].sigla;
    const erro = erroConferencia(rascunho.tipo, rascunho.escopo, rascunho.campos);
    return { sigla, estado: 'novo', erro: erro ? `${sigla}: ${erro}` : null };
  }
  if (atual) return { sigla: TIPOS_DOCUMENTO[atual.tipo].sigla, estado: situacaoValidade(atual.data_validade), erro: null };
  return null;
}

function textoDoc(d: DocRevisao): string {
  switch (d.estado) {
    case 'novo': return `${d.sigla} a salvar`;
    case 'vencido': return `${d.sigla} vencido`;
    case 'vence_em_breve': return `${d.sigla} vence em breve`;
    case 'em_dia': return `${d.sigla} em dia`;
    default: return `${d.sigla} enviado`;
  }
}


function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Checklist da etapa Revisão + dados do card de busca, a partir do estado do form. */
export function revisaoEmbarcacao(args: {
  form: {
    nome: string; embarcacao_tipo_id: string; modalidade_capitao: string;
    capacidade: string; comprimento: string; comprimento_unidade: string;
    estado_id: string; municipio_id: string;
    latitude: string; longitude: string; bairro: string;
  };
  tipos: { id: string; nome: string }[];
  estados: { id: number; uf: string }[];
  municipios: { id: number; nome: string }[];
  comodidadesSelecionadas: string[];
  imagens: GaleriaItem[];
  /** Etapa Documentos; null/ausente = não se aplica (edição pelo admin). */
  documentacao?: { inscricao: DocRevisao | null; dpem: DocRevisao | null } | null;
  ir: (etapa: number) => void;
}): { itens: ItemRevisao[]; card: EmbarcacaoCardData } {
  const { form, ir } = args;
  const tipo = args.tipos.find(t => t.id === form.embarcacao_tipo_id)?.nome ?? null;
  const municipio = args.municipios.find(m => String(m.id) === form.municipio_id)?.nome ?? null;
  const uf = args.estados.find(e => String(e.id) === form.estado_id)?.uf ?? null;
  const localidade = municipio ? (uf ? `${municipio}, ${uf}` : municipio) : null;
  const comprimento = formatarComprimento(form.comprimento, form.comprimento_unidade);
  const temMapa = !!form.latitude && !!form.longitude;
  const capitao = { com_capitao: 'Com capitão', sem_capitao: 'Sem capitão', opcional: 'Capitão opcional' }[form.modalidade_capitao] ?? '';
  const nFotos = args.imagens.length;
  const principal = args.imagens.find(i => i.principal) ?? args.imagens[0];

  const itens: ItemRevisao[] = [
    {
      label: 'Informações gerais',
      status: !form.nome.trim() ? 'erro' : !tipo ? 'aviso' : 'ok',
      resumo: !form.nome.trim()
        ? 'O nome da embarcação é obrigatório.'
        : [form.nome.trim(), tipo ?? 'Tipo não definido', capitao].filter(Boolean).join(' · '),
      onEditar: () => ir(ETAPA_EMB.informacoes),
    },
    {
      label: 'Detalhes',
      status: form.capacidade ? 'ok' : 'aviso',
      resumo: [
        form.capacidade ? plural(Number(form.capacidade), 'pessoa', 'pessoas') : 'Capacidade não informada',
        comprimento,
        plural(args.comodidadesSelecionadas.length, 'comodidade', 'comodidades'),
      ].filter(Boolean).join(' · '),
      onEditar: () => ir(ETAPA_EMB.detalhes),
    },
    {
      label: 'Localização',
      status: localidade && temMapa ? 'ok' : 'aviso',
      resumo: localidade
        ? [form.bairro.trim(), localidade].filter(Boolean).join(', ') + (temMapa ? '' : ' — marque o ponto no mapa')
        : 'Informe o município e o ponto no mapa.',
      onEditar: () => ir(ETAPA_EMB.localizacao),
    },
    {
      label: 'Fotos',
      status: nFotos === 0 ? 'erro' : nFotos >= FOTOS_RECOMENDADAS ? 'ok' : 'aviso',
      resumo: nFotos === 0
        ? 'Nenhuma foto — envie pelo menos 1 (obrigatório para salvar).'
        : nFotos < FOTOS_RECOMENDADAS
          ? `${plural(nFotos, 'foto', 'fotos')} — recomendamos pelo menos ${FOTOS_RECOMENDADAS}.`
          : plural(nFotos, 'foto', 'fotos'),
      onEditar: () => ir(ETAPA_EMB.fotos),
    },
  ];

  if (args.documentacao) {
    const { inscricao, dpem } = args.documentacao;
    const erro = inscricao?.erro ?? dpem?.erro ?? null;
    itens.push({
      label: 'Documentos',
      status: erro ? 'erro' : !inscricao || inscricao.estado === 'vencido' || dpem?.estado === 'vencido' ? 'aviso' : 'ok',
      resumo: erro ?? [
        inscricao ? textoDoc(inscricao) : 'Sem TIE — a embarcação só é aprovada depois que você enviar',
        dpem ? textoDoc(dpem) : 'sem seguro DPEM',
      ].join(' · '),
      onEditar: () => ir(ETAPA_EMB.documentacao),
    });
  }

  const card: EmbarcacaoCardData = {
    id: 'preview',
    nome: form.nome.trim() || 'Nome da embarcação',
    capacidade: form.capacidade ? Number(form.capacidade) : null,
    tipo,
    localidade,
    imagem: principal?.url ?? null,
  };

  return { itens, card };
}
