// Contexto ("origem") de uma conversa de chat: a que objeto ela se refere.
// Compartilhado entre client (ChatBox) e server (e-mail de notificação).

export type OrigemTipo = 'venda' | 'roteiro' | 'embarcacao';

export type ConversaOrigem = {
  tipo: string; // OrigemTipo, mas aceita string vinda do banco
  label: string;
};

const ORIGEM_LABEL: Record<string, string> = {
  venda: 'Venda',
  roteiro: 'Roteiro',
  embarcacao: 'Embarcação',
};

/** Rótulo legível do tipo de origem (ex.: 'embarcacao' → 'Embarcação'). */
export function origemTipoLabel(tipo: string | null | undefined): string {
  if (!tipo) return '';
  return ORIGEM_LABEL[tipo] ?? tipo;
}

/**
 * Monta o objeto de contexto para o ChatBox a partir das colunas da conversa.
 * Retorna `undefined` quando não há origem registrada.
 */
export function toConversaOrigem(
  tipo: string | null | undefined,
  label: string | null | undefined,
): ConversaOrigem | undefined {
  if (!tipo || !label) return undefined;
  return { tipo, label };
}
