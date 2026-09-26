/**
 * Tipos compartilhados (cliente + servidor) do aceite de termos de uso.
 * Módulo puro — sem dependências de servidor.
 */

export type GeoGpsStatus =
  | 'concedida'
  | 'negada'
  | 'indisponivel'
  | 'tempo_esgotado'
  | 'erro'
  | 'nao_solicitada';

export type ConfirmacaoTipo = 'nome' | 'cpf' | 'cnpj';

export type DispositivoTipo = 'desktop' | 'smartphone' | 'tablet' | 'desconhecido';

/** Contextos (ações) em que um termo é aceito. Novo ponto de aceite = novo valor aqui. */
export type AceiteContextoTipo = 'reserva' | 'embarcacao';

export type AceiteContexto = { tipo: AceiteContextoTipo; id?: string | null };

export type GeoGps = {
  status: GeoGpsStatus;
  latitude?: number | null;
  longitude?: number | null;
  precisaoM?: number | null;
};

/**
 * Evidências coletadas no navegador. São informativas/complementares: as
 * evidências fortes (data/hora, IP, sessão, user-agent) são capturadas no servidor.
 */
export type EvidenciasCliente = {
  telaResolucao?: string | null;
  idioma?: string | null;
  fusoHorario?: string | null;
  clienteDataHora?: string | null; // ISO
  geo: GeoGps;
  confirmacaoValor?: string | null; // o que o usuário digitou
  termoAbertoEm?: string | null; // ISO — quando o termo foi exibido
  rolouAteFim?: boolean;
};

export type ConfirmacaoExigida = {
  tipo: ConfirmacaoTipo;
  /** Texto para a instrução, ex.: "seu CPF". */
  rotulo: string;
};

/** Versão vigente de um termo, pronta para exibição e aceite. */
export type TermoParaAceite = {
  id: string;
  identificador: string;
  versao: number;
  titulo: string;
  conteudo: string;
  conteudoHash: string;
  publicadoEm: string;
  exigeRolagemCompleta: boolean;
  /** Preenchido quando o termo exige confirmação digitada (nome ou documento do usuário). */
  confirmacao: ConfirmacaoExigida | null;
};

export type AceiteErroCodigo =
  | 'termo_indisponivel'
  | 'versao_desatualizada'
  | 'leitura_incompleta'
  | 'confirmacao_invalida'
  | 'usuario_invalido'
  | 'erro';

/** Aceite feito na tela, enviado junto com a ação (ex.: criarReserva) para validação e gravação. */
export type AceiteTermoCliente = {
  termoId: string;
  evidencias: EvidenciasCliente;
};
