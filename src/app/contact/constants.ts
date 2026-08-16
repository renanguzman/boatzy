// Constantes compartilhadas entre o formulário (client) e a Server Action.
// Não pode viver em `actions.ts` ('use server'): módulos com essa diretiva só
// podem exportar funções async — um array exportado dali vira uma referência
// opaca no bundle do client, não o valor real (TypeError: .map is not a function).

export const ASSUNTOS_CONTATO = ['Contato', 'Dúvidas', 'Elogio', 'Comercial', 'Financeiro', 'Outros'] as const;
export type AssuntoContato = (typeof ASSUNTOS_CONTATO)[number];
