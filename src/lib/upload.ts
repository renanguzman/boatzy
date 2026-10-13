/**
 * Limites de upload de imagens (embarcações e roteiros).
 *
 * Mantido em um módulo neutro (sem dependências de servidor) para que
 * possa ser importado tanto nas rotas de API quanto nos componentes de
 * formulário no client.
 */

/** Tamanho máximo permitido por arquivo de imagem, em megabytes. */
export const MAX_IMAGE_SIZE_MB = 20;

/** Tamanho máximo permitido por arquivo de imagem, em bytes. */
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/** Mensagem padrão exibida quando um arquivo excede o limite. */
export const MAX_IMAGE_SIZE_ERROR = `O arquivo não pode ser maior que ${MAX_IMAGE_SIZE_MB} MB.`;

export const TIPOS_IMAGEM_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Mínimo obrigatório e quantidade recomendada de fotos por embarcação/roteiro. */
export const FOTOS_MINIMAS = 1;
export const FOTOS_RECOMENDADAS = 5;

/** 3.456.789 bytes → "3,3 MB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
