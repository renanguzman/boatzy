import type { EtapaDef } from '@/components/painel/etapas/IndicadorEtapas';
import type { ItemRevisao } from '@/components/painel/etapas/RevisaoChecklist';
import type { GaleriaItem } from '@/components/painel/GaleriaImagensEditor';
import type { RoteiroCardData } from '@/app/buscar/_components/RoteiroCard';
import { duracaoParaHoras, duracaoTexto, type DuracaoUnidade } from '@/lib/duracao';

/**
 * Etapas do cadastro/edição de roteiro (`NovoRoteiroForm` e
 * `EditarRoteiroForm`) — mesma sequência lógica da embarcação.
 */
export const ETAPAS_ROTEIRO: EtapaDef[] = [
  { id: 'informacoes',     label: 'Informações',     desc: 'Nome, duração e itinerário' },
  { id: 'localizacao',     label: 'Localização',     desc: 'Ponto de partida' },
  { id: 'fotos',           label: 'Fotos',           desc: 'Galeria e títulos' },
  { id: 'preco',           label: 'Preço',           desc: 'Modelos de cobrança' },
  { id: 'disponibilidade', label: 'Disponibilidade', desc: 'Dias e bloqueios' },
  { id: 'adicionais',      label: 'Adicionais',      desc: 'Produtos e serviços' },
  { id: 'revisao',         label: 'Revisão',         desc: 'Conferir e salvar' },
];

export const ETAPA_ROT = {
  informacoes: 0, localizacao: 1, fotos: 2, preco: 3, disponibilidade: 4, adicionais: 5, revisao: 6,
} as const;

const FOTOS_RECOMENDADAS = 5;
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Checklist da etapa Revisão + dados do card de busca, a partir do estado do form. */
export function revisaoRoteiro(args: {
  form: {
    nome: string; descricao: string; embarcacao_id: string;
    duracao_valor: string; duracao_unidade: DuracaoUnidade; quantidade_pessoas: string;
    origem: string; destino: string;
    preco_base: string;
    preco_diaria_ativo: boolean; preco_diaria_valor: string;
    preco_pessoa_ativo: boolean; preco_pessoa_valor: string;
    estado_id: string; municipio_id: string; latitude: string; longitude: string;
  };
  embarcacoes: { id: string; nome: string }[];
  estados: { id: number; uf: string }[];
  municipios: { id: number; nome: string }[];
  paradas: { nome: string }[];
  imagens: GaleriaItem[];
  diasOperacao: number[];
  bloqueios: string[];
  totalAdicionais: number;
  ir: (etapa: number) => void;
}): { itens: ItemRevisao[]; card: RoteiroCardData } {
  const { form, ir } = args;
  const duracao = duracaoTexto(duracaoParaHoras(form.duracao_valor, form.duracao_unidade));
  const embarcacao = args.embarcacoes.find(e => e.id === form.embarcacao_id)?.nome ?? null;
  const municipio = args.municipios.find(m => String(m.id) === form.municipio_id)?.nome ?? null;
  const uf = args.estados.find(e => String(e.id) === form.estado_id)?.uf ?? null;
  const localidade = municipio ? (uf ? `${municipio}, ${uf}` : municipio) : null;
  const temMapa = !!form.latitude && !!form.longitude;
  const nFotos = args.imagens.length;
  const nParadas = args.paradas.filter(p => p.nome.trim()).length;

  const precoBase = form.preco_base ? Number(form.preco_base) : null;
  const diaria = form.preco_diaria_ativo && form.preco_diaria_valor ? Number(form.preco_diaria_valor) : null;
  const pessoa = form.preco_pessoa_ativo && form.preco_pessoa_valor ? Number(form.preco_pessoa_valor) : null;
  const modelos = [
    precoBase != null && `Passeio ${brl(precoBase)}`,
    diaria != null && `Diária ${brl(diaria)}`,
    pessoa != null && `Por pessoa ${brl(pessoa)}`,
  ].filter(Boolean) as string[];

  const faltaObrigatorio = !form.nome.trim() || !form.descricao.trim();

  const itens: ItemRevisao[] = [
    {
      label: 'Informações gerais',
      status: faltaObrigatorio ? 'erro' : !duracao ? 'aviso' : 'ok',
      resumo: faltaObrigatorio
        ? 'Nome e descrição do roteiro são obrigatórios.'
        : [
            form.nome.trim(),
            duracao ?? 'Duração não informada',
            form.quantidade_pessoas ? plural(Number(form.quantidade_pessoas), 'pessoa', 'pessoas') : null,
            embarcacao,
            nParadas ? plural(nParadas, 'parada', 'paradas') : null,
          ].filter(Boolean).join(' · '),
      onEditar: () => ir(ETAPA_ROT.informacoes),
    },
    {
      label: 'Localização de partida',
      status: localidade && temMapa ? 'ok' : 'aviso',
      resumo: localidade
        ? localidade + (temMapa ? '' : ' — marque o ponto no mapa')
        : 'Informe o município e o ponto de partida no mapa.',
      onEditar: () => ir(ETAPA_ROT.localizacao),
    },
    {
      label: 'Fotos',
      status: nFotos >= FOTOS_RECOMENDADAS ? 'ok' : 'aviso',
      resumo: nFotos === 0
        ? 'Nenhuma foto — roteiros com fotos recebem muito mais reservas.'
        : nFotos < FOTOS_RECOMENDADAS
          ? `${plural(nFotos, 'foto', 'fotos')} — recomendamos pelo menos ${FOTOS_RECOMENDADAS}.`
          : plural(nFotos, 'foto', 'fotos'),
      onEditar: () => ir(ETAPA_ROT.fotos),
    },
    {
      label: 'Preço',
      status: modelos.length > 0 ? 'ok' : 'aviso',
      resumo: modelos.length > 0 ? modelos.join(' · ') : 'Nenhum preço informado — o site mostrará "Consulte o preço".',
      onEditar: () => ir(ETAPA_ROT.preco),
    },
    {
      label: 'Disponibilidade',
      status: 'ok',
      resumo: `${args.diasOperacao.length === 0 || args.diasOperacao.length === 7
        ? 'Todos os dias'
        : [...args.diasOperacao].sort().map(d => DIAS[d]).join(', ')} · ${plural(args.bloqueios.length, 'data bloqueada', 'datas bloqueadas')}`,
      onEditar: () => ir(ETAPA_ROT.disponibilidade),
    },
    {
      label: 'Adicionais',
      status: 'ok',
      resumo: args.totalAdicionais > 0
        ? plural(args.totalAdicionais, 'item do catálogo', 'itens do catálogo')
        : 'Nenhum adicional — opcional.',
      onEditar: () => ir(ETAPA_ROT.adicionais),
    },
  ];

  const card: RoteiroCardData = {
    id: 'preview',
    nome: form.nome.trim() || 'Nome do roteiro',
    descricao: form.descricao.trim(),
    quantidade_pessoas: form.quantidade_pessoas ? Number(form.quantidade_pessoas) : null,
    preco_base: precoBase,
    preco_diaria_ativo: form.preco_diaria_ativo,
    preco_diaria_valor: diaria,
    preco_pessoa_ativo: form.preco_pessoa_ativo,
    preco_pessoa_valor: pessoa,
    duracao,
    municipios: municipio ? { nome: municipio, estados: uf ? { uf } : null } : null,
    roteiro_imagens: args.imagens.map(i => ({ url_imagem: i.url, principal: i.principal })),
    embarcacao: null,
  };

  return { itens, card };
}
