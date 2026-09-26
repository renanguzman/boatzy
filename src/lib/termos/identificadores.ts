/**
 * Identificadores FIXOS dos termos de uso da plataforma.
 *
 * Cada identificador é um ponto do sistema onde um termo é exibido/aceito.
 * O código busca a versão vigente sempre por identificador (nunca por id),
 * então novos pontos de aceite entram aqui junto com a integração no fluxo.
 * O banco (`termos_uso_plataforma.identificador`) só valida o formato.
 */

export type TermoPublicoAlvo = 'cliente' | 'gestor' | 'todos';

export type TermoIdentificadorInfo = {
  label: string;
  descricao: string;
  publicoAlvo: TermoPublicoAlvo;
};

export const TERMOS_IDENTIFICADORES = {
  reserva_cliente: {
    label: 'Reserva — cliente',
    descricao: 'Aceito pelo cliente ao confirmar uma reserva de roteiro ou embarcação.',
    publicoAlvo: 'cliente',
  },
  cadastro_embarcacao_gestor: {
    label: 'Cadastro de embarcação — gestor',
    descricao: 'Aceito pelo dono da embarcação ao registrá-la na plataforma.',
    publicoAlvo: 'gestor',
  },
  termos_gerais_plataforma: {
    label: 'Termos gerais da plataforma',
    descricao: 'Termos de Uso gerais, exibidos publicamente em /terms.',
    publicoAlvo: 'todos',
  },
  politica_privacidade: {
    label: 'Política de Privacidade',
    descricao: 'Política de Privacidade (LGPD), exibida publicamente em /privacy.',
    publicoAlvo: 'todos',
  },
} as const satisfies Record<string, TermoIdentificadorInfo>;

export type TermoIdentificador = keyof typeof TERMOS_IDENTIFICADORES;

export const TERMO_PUBLICO_ALVO_LABEL: Record<TermoPublicoAlvo, string> = {
  cliente: 'Cliente',
  gestor: 'Gestor',
  todos: 'Todos',
};

export function isTermoIdentificador(v: string): v is TermoIdentificador {
  return Object.prototype.hasOwnProperty.call(TERMOS_IDENTIFICADORES, v);
}

/** Label amigável; identificadores fora da lista (legado) aparecem crus. */
export function termoIdentificadorLabel(v: string): string {
  return isTermoIdentificador(v) ? TERMOS_IDENTIFICADORES[v].label : v;
}
