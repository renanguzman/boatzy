import type { DocumentoEscopo, DocumentoTipo, EquipeFuncao } from '@/types/supabase';

/**
 * Registro dos tipos de documento (SPEC §95) — módulo neutro, usado no
 * servidor e no navegador. Incluir um tipo novo = uma entrada aqui + o valor
 * no CHECK de `documento.tipo` (migration).
 *
 * Nomes conforme a Autoridade Marítima (NORMAM-211/212).
 */
export type TipoDocumentoInfo = {
  tipo: DocumentoTipo;
  escopo: DocumentoEscopo;
  sigla: string;
  nome: string;
  /** Uma linha para o gestor saber quando o documento se aplica. */
  descricao: string;
  /** Validade usual em anos (dica no formulário); null = não vence. */
  validadeAnos: number | null;
  /** Orientação de renovação (avisos e e-mails). */
  renovacao: string | null;
  /** Rótulos dos campos no formulário. */
  rotuloNumero: string;
  rotuloTitular: string;
  /** Mostra o campo "Categoria" (habilitação). */
  temCategoria: boolean;
  /** Pede o nome do documento (tipo "Outro"). */
  temTitulo: boolean;
};

export const TIPOS_DOCUMENTO: Record<DocumentoTipo, TipoDocumentoInfo> = {
  tie: {
    tipo: 'tie',
    escopo: 'embarcacao',
    sigla: 'TIE',
    nome: 'Título de Inscrição de Embarcação',
    descricao: 'O "documento do barco": inscrição na Capitania das embarcações de até 100 AB.',
    validadeAnos: 5,
    renovacao: 'Peça a renovação na Capitania, Delegacia ou Agência até 30 dias antes do vencimento.',
    rotuloNumero: 'Número de inscrição',
    rotuloTitular: 'Proprietário',
    temCategoria: false,
    temTitulo: false,
  },
  tiem: {
    tipo: 'tiem',
    escopo: 'embarcacao',
    sigla: 'TIEM',
    nome: 'Título de Inscrição de Embarcação Miúda',
    descricao: 'Inscrição das embarcações miúdas (botes, caiaques motorizados e similares).',
    validadeAnos: 5,
    renovacao: 'Peça a renovação na Capitania, Delegacia ou Agência até 30 dias antes do vencimento.',
    rotuloNumero: 'Número de inscrição',
    rotuloTitular: 'Proprietário',
    temCategoria: false,
    temTitulo: false,
  },
  dpem: {
    tipo: 'dpem',
    escopo: 'embarcacao',
    sigla: 'DPEM',
    nome: 'Seguro DPEM',
    descricao: 'Seguro obrigatório de Danos Pessoais causados por Embarcações. Renovação anual.',
    validadeAnos: 1,
    renovacao: 'Renove pelo Portal DPEM pelo menos duas semanas antes do fim da vigência.',
    rotuloNumero: 'Número da apólice',
    rotuloTitular: 'Proprietário',
    temCategoria: false,
    temTitulo: false,
  },
  prpm: {
    tipo: 'prpm',
    escopo: 'embarcacao',
    sigla: 'PRPM',
    nome: 'Provisão de Registro da Propriedade Marítima',
    descricao: 'Registro no Tribunal Marítimo, para embarcações acima de 100 AB. Não vence.',
    validadeAnos: null,
    renovacao: null,
    rotuloNumero: 'Número do registro',
    rotuloTitular: 'Proprietário',
    temCategoria: false,
    temTitulo: false,
  },
  cha: {
    tipo: 'cha',
    escopo: 'condutor',
    sigla: 'CHA',
    nome: 'Carteira de Habilitação de Amador',
    descricao: 'Habilitação náutica do condutor (Arrais, Mestre, Capitão-Amador, Motonauta ou Veleiro).',
    validadeAnos: 10,
    renovacao: 'Peça a renovação na Capitania. Vencida há mais de 5 anos, é preciso refazer a prova.',
    rotuloNumero: 'Número da CHA',
    rotuloTitular: 'Nome do condutor',
    temCategoria: true,
    temTitulo: false,
  },
  cir: {
    tipo: 'cir',
    escopo: 'condutor',
    sigla: 'CIR',
    nome: 'Caderneta de Inscrição e Registro',
    descricao: 'Documento do aquaviário profissional (marinheiro de convés, moço de convés…).',
    validadeAnos: null,
    renovacao: 'Procure a Capitania para renovar a caderneta.',
    rotuloNumero: 'Número da CIR',
    rotuloTitular: 'Nome do condutor',
    temCategoria: false,
    temTitulo: false,
  },
  outro: {
    tipo: 'outro',
    escopo: 'embarcacao',
    sigla: 'Outro',
    nome: 'Outro documento',
    descricao: 'Qualquer outro documento com vencimento que você queira acompanhar.',
    validadeAnos: null,
    renovacao: null,
    rotuloNumero: 'Número',
    rotuloTitular: 'Titular',
    temCategoria: false,
    temTitulo: true,
  },
};

/** Tipos oferecidos em cada escopo, na ordem de exibição. */
export const TIPOS_POR_ESCOPO: Record<DocumentoEscopo, DocumentoTipo[]> = {
  embarcacao: ['tie', 'tiem', 'dpem', 'prpm', 'outro'],
  condutor: ['cha', 'cir', 'outro'],
};

/** Documentos de inscrição: toda embarcação precisa de um deles ativo (senão fica "pendente"). */
export const TIPOS_INSCRICAO: DocumentoTipo[] = ['tie', 'tiem', 'prpm'];

/** Categorias da CHA (valor gravado em `documento.categoria`). */
export const CATEGORIAS_CHA = [
  { valor: 'motonauta', rotulo: 'Motonauta' },
  { valor: 'veleiro', rotulo: 'Veleiro' },
  { valor: 'arrais', rotulo: 'Arrais-Amador' },
  { valor: 'mestre', rotulo: 'Mestre-Amador' },
  { valor: 'capitao', rotulo: 'Capitão-Amador' },
] as const;

export function rotuloCategoria(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return CATEGORIAS_CHA.find((c) => c.valor === valor)?.rotulo ?? valor;
}

export const FUNCOES_EQUIPE: { valor: EquipeFuncao; rotulo: string }[] = [
  { valor: 'marinheiro', rotulo: 'Marinheiro' },
  { valor: 'capitao', rotulo: 'Capitão' },
  { valor: 'auxiliar', rotulo: 'Auxiliar' },
];

export function rotuloFuncao(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return FUNCOES_EQUIPE.find((f) => f.valor === valor)?.rotulo ?? null;
}

/** Nome curto para listas: sigla (ou o título, no tipo "Outro"). */
export function nomeCurtoDocumento(tipo: DocumentoTipo, titulo?: string | null): string {
  return tipo === 'outro' ? (titulo?.trim() || 'Outro documento') : TIPOS_DOCUMENTO[tipo].sigla;
}

/** Extras não sensíveis guardados em `documento.dados`. */
export type DadosDocumento = {
  qtd_passageiros?: number | null;
  qtd_tripulantes?: number | null;
  tipo_embarcacao?: string | null;
  area_navegacao?: string | null;
  atividade?: string | null;
};

/** Arquivos aceitos no envio (fotos e PDF). */
export const TIPOS_ARQUIVO_DOCUMENTO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const MAX_ARQUIVO_DOCUMENTO_MB = 20;
export const MAX_ARQUIVO_DOCUMENTO_BYTES = MAX_ARQUIVO_DOCUMENTO_MB * 1024 * 1024;
