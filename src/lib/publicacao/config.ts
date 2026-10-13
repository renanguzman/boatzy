/**
 * Pipeline de aprovação de publicações (embarcação, roteiro e anúncio de venda).
 *
 * Regra: o gestor cria e envia para análise; só o admin publica (Em análise →
 * Ativo) ou devolve (→ Retorno, com observação). O gestor pode tirar do ar e,
 * para voltar, sempre passa de novo pela análise. Editar campo sensível de um
 * registro Ativo o devolve para análise.
 *
 * Quem decide se uma transição é válida é o banco
 * (`transicionar_publicacao`, migration 20261013b). A matriz abaixo é um
 * espelho só para a interface montar os botões — mantenha as duas iguais.
 * Arquivo sem dependências de servidor: pode ser importado no client.
 */

import type { AnuncioVendaStatus } from '@/types/supabase';

export type PublicacaoEntidade = 'embarcacao' | 'roteiro' | 'anuncio_venda';
export type PublicacaoStatus = 'em_analise' | 'retorno' | 'ativo' | 'inativo' | 'em_manutencao';
export type StatusPublicacaoQualquer = PublicacaoStatus | AnuncioVendaStatus;
export type PapelPublicacao = 'gestor' | 'admin';

export type TipoEventoPublicacao =
  | 'criacao' | 'envio_analise' | 'reativacao' | 'edicao_sensivel'
  | 'aprovacao' | 'retorno' | 'moderacao'
  | 'inativacao' | 'manutencao' | 'pausa' | 'venda' | 'cancelamento'
  | 'migracao';

export const ENTIDADE_LABEL: Record<PublicacaoEntidade, { singular: string; artigo: 'a' | 'o' }> = {
  embarcacao:    { singular: 'embarcação', artigo: 'a' },
  roteiro:       { singular: 'roteiro', artigo: 'o' },
  anuncio_venda: { singular: 'anúncio', artigo: 'o' },
};

type StatusInfo = {
  label: string;
  /** Classes do badge (fundo + texto). */
  badge: string;
  /** Cor do ponto da timeline. */
  dot: string;
  /** Explicação curta para o gestor. */
  descricao: string;
};

export const STATUS_INFO: Record<StatusPublicacaoQualquer, StatusInfo> = {
  em_analise: {
    label: 'Em análise', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500',
    descricao: 'Aguardando a análise da equipe Boatzy. Ainda não aparece no site.',
  },
  retorno: {
    label: 'Retorno', badge: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500',
    descricao: 'Devolvido pela equipe Boatzy para ajustes. Corrija e reenvie para análise.',
  },
  ativo: {
    label: 'Ativo', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500',
    descricao: 'Aprovado e publicado no site.',
  },
  inativo: {
    label: 'Inativo', badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400',
    descricao: 'Fora do site. Para voltar, solicite a reativação (passa por nova análise).',
  },
  em_manutencao: {
    label: 'Em manutenção', badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500',
    descricao: 'Fora do site durante a manutenção. Para voltar, solicite a reativação (passa por nova análise).',
  },
  pausado: {
    label: 'Pausado', badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400',
    descricao: 'Fora do site. Para voltar, solicite a reativação (passa por nova análise).',
  },
  vendido: {
    label: 'Vendido', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500',
    descricao: 'Anúncio encerrado como vendido.',
  },
  cancelado: {
    label: 'Cancelado', badge: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-400',
    descricao: 'Anúncio encerrado.',
  },
};

export const TIPO_EVENTO_LABEL: Record<TipoEventoPublicacao, string> = {
  criacao:         'Cadastro concluído e enviado para análise',
  envio_analise:   'Reenviado para análise',
  reativacao:      'Reativação solicitada (enviado para análise)',
  edicao_sensivel: 'Editado — voltou para análise',
  aprovacao:       'Aprovado e publicado',
  retorno:         'Devolvido para ajustes',
  moderacao:       'Retirado do ar pela equipe Boatzy',
  inativacao:      'Inativado',
  manutencao:      'Colocado em manutenção',
  pausa:           'Pausado',
  venda:           'Marcado como vendido',
  cancelamento:    'Cancelado',
  migracao:        'Registro anterior à aprovação de publicações',
};

/** Nome amigável das chaves de `publicacao_snapshot` (campos sensíveis). */
export const CAMPO_SENSIVEL_LABEL: Record<string, string> = {
  nome: 'Nome',
  descricao: 'Descrição',
  embarcacao_tipo_id: 'Tipo',
  modalidade_capitao: 'Capitão',
  capacidade: 'Capacidade',
  comprimento: 'Comprimento',
  comprimento_unidade: 'Unidade do comprimento',
  quartos: 'Quartos',
  banheiros: 'Banheiros',
  tripulacao: 'Tripulação',
  localizacao: 'Localização',
  fotos: 'Fotos',
  origem: 'Origem',
  destino: 'Destino',
  embarcacao_id: 'Embarcação vinculada',
  duracao_horas: 'Duração',
  paradas: 'Paradas',
  fabricante: 'Fabricante',
  ano_modelo: 'Ano do modelo',
  ano_fabricacao: 'Ano de fabricação',
  descricao_venda: 'Descrição do anúncio',
};

export function rotuloCampos(campos: string[] | null | undefined): string {
  return (campos ?? []).map(c => CAMPO_SENSIVEL_LABEL[c] ?? c).join(', ');
}

/** Espelho de `publicacao_tipo_transicao` (SQL). */
export function tipoTransicao(
  entidade: PublicacaoEntidade,
  papel: PapelPublicacao,
  de: StatusPublicacaoQualquer,
  para: StatusPublicacaoQualquer,
): TipoEventoPublicacao | null {
  const em = (...s: StatusPublicacaoQualquer[]) => s.includes(de);
  if (entidade === 'anuncio_venda') {
    if (papel === 'gestor') {
      if (de === 'retorno' && para === 'em_analise') return 'envio_analise';
      if (de === 'pausado' && para === 'em_analise') return 'reativacao';
      if (de === 'ativo' && para === 'em_analise') return 'edicao_sensivel';
      if (de === 'ativo' && para === 'pausado') return 'pausa';
      if (em('ativo', 'pausado') && para === 'vendido') return 'venda';
      if (em('em_analise', 'retorno', 'ativo', 'pausado') && para === 'cancelado') return 'cancelamento';
      return null;
    }
    if (de === 'em_analise' && para === 'ativo') return 'aprovacao';
    if (de === 'em_analise' && para === 'retorno') return 'retorno';
    if (em('em_analise', 'retorno', 'ativo') && para === 'pausado') return 'moderacao';
    return null;
  }
  if (papel === 'gestor') {
    if (de === 'retorno' && para === 'em_analise') return 'envio_analise';
    if (em('inativo', 'em_manutencao') && para === 'em_analise') return 'reativacao';
    if (de === 'ativo' && para === 'em_analise') return 'edicao_sensivel';
    if (em('em_analise', 'retorno', 'ativo', 'em_manutencao') && para === 'inativo') return 'inativacao';
    if (de === 'ativo' && para === 'em_manutencao') return 'manutencao';
    return null;
  }
  if (de === 'em_analise' && para === 'ativo') return 'aprovacao';
  if (de === 'em_analise' && para === 'retorno') return 'retorno';
  if (em('em_analise', 'retorno', 'ativo', 'em_manutencao') && para === 'inativo') return 'moderacao';
  return null;
}

export type AcaoGestor = {
  para: StatusPublicacaoQualquer;
  tipo: TipoEventoPublicacao;
  label: string;
  /** Texto do modal de confirmação. */
  confirmacao: string;
  /** Ação que tira o registro do site (destaque visual de alerta). */
  tiraDoAr: boolean;
  /** Mostra campo de mensagem opcional para a equipe Boatzy. */
  aceitaMensagem: boolean;
  /** Encerra o anúncio de vez (vendido/cancelado). */
  terminal?: boolean;
};

/**
 * Ações manuais que o gestor pode tomar no status atual (a volta automática
 * para análise por edição não é um botão).
 */
export function acoesGestor(entidade: PublicacaoEntidade, status: StatusPublicacaoQualquer): AcaoGestor[] {
  const nome = ENTIDADE_LABEL[entidade].singular;
  const a = ENTIDADE_LABEL[entidade].artigo;
  const candidatas: Omit<AcaoGestor, 'tipo'>[] = entidade === 'anuncio_venda'
    ? [
        { para: 'em_analise', label: status === 'retorno' ? 'Reenviar para análise' : 'Solicitar reativação',
          confirmacao: `O ${nome} será enviado para a análise da equipe Boatzy e só volta ao site após a aprovação.`,
          tiraDoAr: false, aceitaMensagem: true },
        { para: 'pausado', label: 'Pausar anúncio',
          confirmacao: 'O anúncio sai do site. Para voltar, ele passa por nova análise.',
          tiraDoAr: true, aceitaMensagem: false },
        { para: 'vendido', label: 'Marcar como vendido',
          confirmacao: 'O anúncio é encerrado como vendido e sai do site. Esta ação não pode ser desfeita.',
          tiraDoAr: true, aceitaMensagem: false, terminal: true },
        { para: 'cancelado', label: 'Cancelar anúncio',
          confirmacao: 'O anúncio é encerrado e sai do site. Esta ação não pode ser desfeita.',
          tiraDoAr: true, aceitaMensagem: false, terminal: true },
      ]
    : [
        { para: 'em_analise', label: status === 'retorno' ? 'Reenviar para análise' : 'Solicitar reativação',
          confirmacao: `${a === 'a' ? 'A' : 'O'} ${nome} será enviad${a} para a análise da equipe Boatzy e só aparece no site após a aprovação.`,
          tiraDoAr: false, aceitaMensagem: true },
        { para: 'em_manutencao', label: 'Colocar em manutenção',
          confirmacao: `${a === 'a' ? 'A' : 'O'} ${nome} sai do site enquanto estiver em manutenção. Para voltar, passa por nova análise.`,
          tiraDoAr: true, aceitaMensagem: false },
        { para: 'inativo', label: 'Inativar',
          confirmacao: `${a === 'a' ? 'A' : 'O'} ${nome} sai do site. Para voltar, passa por nova análise.`,
          tiraDoAr: true, aceitaMensagem: false },
      ];

  return candidatas.flatMap(c => {
    const tipo = tipoTransicao(entidade, 'gestor', status, c.para);
    // A volta por edição é automática, não um botão.
    if (!tipo || tipo === 'edicao_sensivel') return [];
    return [{ ...c, tipo }];
  });
}

/** Status em que o registro aparece no site (para avisos na interface). */
export function estaNoAr(status: StatusPublicacaoQualquer): boolean {
  return status === 'ativo';
}
