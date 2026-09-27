/**
 * Galeria de imagens (embarcação e roteiro) — regras compartilhadas entre o
 * editor do painel (`GaleriaImagensEditor`), as server actions e as telas
 * públicas.
 *
 * - `ordem` (0, 1, 2…) é a sequência da galeria no site, definida pelo gestor.
 * - `principal` é a capa usada nos cards/listagens (independe da ordem).
 * - `titulo` é a legenda exibida junto da foto ("Proa do iate").
 *
 * Módulo puro (sem `server-only`).
 */

export const TITULO_IMAGEM_MAX = 80;

/** Limpa o título digitado: trim, colapsa espaços, corta no máximo. Vazio → null. */
export function normalizarTituloImagem(titulo: string | null | undefined): string | null {
  const t = (titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, TITULO_IMAGEM_MAX);
  return t || null;
}

/** Ordena as imagens para exibição: `ordem` crescente (principal desempata). */
export function ordenarImagens<T extends { ordem?: number | null; principal: boolean }>(imgs: T[]): T[] {
  return [...imgs].sort((a, b) => {
    const d = (a.ordem ?? 0) - (b.ordem ?? 0);
    if (d !== 0) return d;
    return a.principal === b.principal ? 0 : a.principal ? -1 : 1;
  });
}
