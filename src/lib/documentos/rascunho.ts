import type { DocumentoEstrangeiroEquipe } from '@/lib/equipe-documento';
import type { DocumentoEscopo, DocumentoOrigem, DocumentoTipo, EquipeFuncao } from '@/types/supabase';
import { isValidCPF, maskCPF, onlyDigits } from '@/lib/validators';
import type { ArquivoEnviado } from './envio';
import type { CamposLidos } from './leitura';
import type { QualidadeFoto } from './qualidade-foto';
import { nomeApresentavel } from './nomes';
import { TIPOS_DOCUMENTO, TIPOS_POR_ESCOPO, type DadosDocumento } from './tipos';

/**
 * Conferência de um documento (SPEC §95.4 e §95.10) — os mesmos campos e regras no
 * envio pelo menu Documentos (`DocumentoWizard`) e nos documentos embutidos nos
 * cadastros (embarcação, equipe e pedido de acesso do gestor — `DocumentoEmbutido`).
 * Módulo neutro: sem React e sem servidor.
 */

export type CamposDocumento = {
  titulo: string;
  numero: string;
  titular: string;
  /** CPF do titular da habilitação (com máscara). */
  cpf: string;
  embarcacaoNome: string;
  /** Categorias da habilitação separadas por vírgula ("mestre,motonauta"). */
  categoria: string;
  dataEmissao: string;
  dataValidade: string;
};

/** Extras da habilitação editáveis na conferência (gravados em `documento.dados`). */
export type ExtraCondutor = 'limites_navegacao' | 'orgao_emissor';
export type CampoLido = keyof CamposDocumento | ExtraCondutor;

export const CAMPOS_VAZIOS: CamposDocumento = {
  titulo: '', numero: '', titular: '', cpf: '', embarcacaoNome: '', categoria: '', dataEmissao: '', dataValidade: '',
};

/** 'AAAA-MM-DD' + N anos (29/02 vira 28/02 quando o ano não é bissexto). */
export function somarAnos(iso: string, anos: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a + anos, m - 1, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return `${alvo.getUTCFullYear()}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

/** Leitura automática convertida para o formulário. */
export type LeituraAplicada = {
  campos: Partial<CamposDocumento>;
  dados: DadosDocumento;
  /** Campos preenchidos pela leitura (selo "lido do documento"). */
  lidos: CampoLido[];
  /** Tipo que o arquivo aparenta ser, quando difere do escolhido (e é do mesmo escopo). */
  tipoSugerido: DocumentoTipo | null;
};

export function aplicarLeitura(c: CamposLidos, tipo: DocumentoTipo, escopo: DocumentoEscopo): LeituraAplicada {
  const info = TIPOS_DOCUMENTO[tipo];
  const campos: Partial<CamposDocumento> = {};
  if (c.numero) campos.numero = c.numero;
  if (c.dataValidade) campos.dataValidade = c.dataValidade;
  if (c.dataEmissao) campos.dataEmissao = c.dataEmissao;
  if (c.titular) campos.titular = escopo === 'condutor' ? nomeApresentavel(c.titular) : c.titular;
  if (c.embarcacaoNome && escopo === 'embarcacao') campos.embarcacaoNome = c.embarcacaoNome;
  if (c.categoria && info.temCategoria) campos.categoria = c.categoria;
  if (c.cpf && escopo === 'condutor') campos.cpf = maskCPF(c.cpf);

  const lidos = Object.keys(campos) as CampoLido[];
  let dados: DadosDocumento;
  if (escopo === 'condutor') {
    dados = { limites_navegacao: c.limitesNavegacao, orgao_emissor: c.orgaoEmissor };
    if (c.limitesNavegacao) lidos.push('limites_navegacao');
    if (c.orgaoEmissor) lidos.push('orgao_emissor');
  } else {
    dados = { tipo_embarcacao: c.tipoEmbarcacao, area_navegacao: c.areaNavegacao, atividade: c.atividade };
  }

  const tipoSugerido =
    c.tipoDetectado && c.tipoDetectado !== tipo && TIPOS_POR_ESCOPO[escopo].includes(c.tipoDetectado) ? c.tipoDetectado : null;
  return { campos, dados, lidos, tipoSugerido };
}

export const AVISO_LEITURA_VAZIA =
  'Não encontramos os dados no arquivo — a foto pode estar inclinada, escura ou com reflexo. Preencha os campos abaixo.';
export const AVISO_LEITURA_FALHOU = 'Não conseguimos ler o documento automaticamente. Preencha os campos abaixo.';

/** O que impede salvar (as mesmas regras do servidor — `validarCamposDocumento`), ou null. */
export function erroConferencia(tipo: DocumentoTipo, escopo: DocumentoEscopo, campos: CamposDocumento): string | null {
  const info = TIPOS_DOCUMENTO[tipo];
  if (info.temTitulo && !campos.titulo.trim()) return 'Informe o nome do documento.';
  if (info.validadeAnos != null && !campos.dataValidade) {
    return `Informe a validade do ${info.sigla} — é ela que gera os avisos de vencimento.`;
  }
  if (campos.dataEmissao && campos.dataValidade && campos.dataValidade < campos.dataEmissao) {
    return `A validade do ${info.sigla} não pode ser anterior à emissão.`;
  }
  if (escopo === 'condutor' && onlyDigits(campos.cpf) && !isValidCPF(campos.cpf)) {
    return 'CPF do condutor inválido — confira os números ou deixe em branco.';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rascunho: documento conferido no navegador, ainda não salvo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Documento escolhido e conferido dentro de outro cadastro (embarcação, membro da
 * equipe, pedido de gestor). Fica no estado do formulário e é gravado junto com
 * ele: o arquivo sobe para a pasta do `id` e o registro é criado com o alvo
 * (embarcação/membro) já existente.
 */
export type RascunhoDocumento = {
  /** Id do documento, gerado no navegador (pasta do arquivo no bucket). */
  id: string;
  escopo: DocumentoEscopo;
  tipo: DocumentoTipo;
  arquivo: File;
  campos: CamposDocumento;
  dados: DadosDocumento;
  origem: DocumentoOrigem;
  lidos: CampoLido[];
  /** Avaliação da foto (câmera ou galeria); null em PDF. */
  qualidade: QualidadeFoto | null;
  /** A leitura falhou ou não achou nada. */
  avisoLeitura: string | null;
  tipoSugerido: DocumentoTipo | null;
};

/** Documento ativo já salvo, como os cadastros o mostram (resumo + "Substituir"). */
export type DocumentoAtual = {
  id: string;
  tipo: DocumentoTipo;
  titulo: string | null;
  numero: string | null;
  titular: string | null;
  categoria: string | null;
  data_validade: string | null;
  tem_arquivo: boolean;
};

/** Quem é o condutor da habilitação: alguém da equipe ou um cadastro novo. */
export type CondutorPayload =
  | { modo: 'existente'; membroId: string }
  | { modo: 'novo'; nome: string; cpf: string; funcao: EquipeFuncao; estrangeiro?: DocumentoEstrangeiroEquipe | null };

export type DocumentoPayload = {
  /** Gerado no navegador (o arquivo sobe para a pasta dele antes do registro existir). */
  id: string;
  escopo: DocumentoEscopo;
  tipo: DocumentoTipo;
  embarcacaoId: string | null;
  condutor: CondutorPayload | null;
  /** Embarcações em que o condutor trabalha (vínculo na equipe) — uma ou várias. */
  embarcacoesDoCondutorIds: string[];
  titulo: string;
  numero: string;
  titular: string;
  /** CPF do titular da habilitação (com ou sem máscara; vazio = não informado). */
  cpf: string;
  embarcacaoNome: string;
  /** Categorias da habilitação separadas por vírgula ("mestre,motonauta"). */
  categoria: string;
  dataEmissao: string;
  dataValidade: string;
  dados: DadosDocumento;
  origem: DocumentoOrigem;
  arquivo: ArquivoEnviado | null;
};

/** Payload de `criarDocumento` para um rascunho cujo alvo já existe. */
export function payloadDoRascunho(
  r: RascunhoDocumento,
  arquivo: ArquivoEnviado,
  alvo: { embarcacaoId: string } | { membroId: string } | null,
): DocumentoPayload {
  return {
    id: r.id,
    escopo: r.escopo,
    tipo: r.tipo,
    embarcacaoId: alvo && 'embarcacaoId' in alvo ? alvo.embarcacaoId : null,
    condutor: alvo && 'membroId' in alvo ? { modo: 'existente', membroId: alvo.membroId } : null,
    embarcacoesDoCondutorIds: [],
    ...r.campos,
    dados: r.dados,
    origem: r.origem,
    arquivo,
  };
}
