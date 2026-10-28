/**
 * Comparação de nomes de pessoas e embarcações (SPEC §95.5) — usada para
 * vincular a habilitação a alguém da equipe e para reconhecer a embarcação
 * lida no documento. Sem dependências: roda no servidor e no navegador.
 */

const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'D']);

/** Maiúsculas, sem acento, só letras/dígitos e espaços simples. */
export function normalizarNome(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palavras significativas do nome (sem "de", "da", "dos"…). */
export function tokensNome(valor: string): string[] {
  return normalizarNome(valor).split(' ').filter((t) => t && !PARTICULAS.has(t));
}

/**
 * Semelhança entre dois nomes de pessoa, de 0 a 1.
 *  - 1: mesmos nomes (ignorando acentos, maiúsculas e partículas);
 *  - ≥ 0,85: mesmo primeiro e último nome ("João Silva" × "João Pedro da Silva");
 *  - senão: proporção de nomes em comum (Jaccard).
 */
export function similaridadeNomes(a: string, b: string): number {
  const ta = tokensNome(a);
  const tb = tokensNome(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  if (ta.join(' ') === tb.join(' ')) return 1;

  const sa = new Set(ta);
  const sb = new Set(tb);
  const comuns = [...sa].filter((t) => sb.has(t)).length;
  let nota = comuns / new Set([...sa, ...sb]).size;

  const mesmoPrimeiro = ta[0] === tb[0];
  if (mesmoPrimeiro && ta.length > 1 && tb.length > 1 && ta[ta.length - 1] === tb[tb.length - 1]) {
    nota = Math.max(nota, 0.85);
  }
  return nota;
}

/** Nome confirmado como a mesma pessoa (vínculo automático). */
export const SIMILARIDADE_EXATA = 1;
/** A partir daqui o painel pergunta "É esta pessoa?". */
export const SIMILARIDADE_SUGESTAO = 0.6;

/** "JOAO DA SILVA" → "Joao da Silva" (o OCR lê em maiúsculas; o gestor pode corrigir acentos). */
export function nomeApresentavel(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p.toUpperCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/**
 * Procura, no texto lido, um dos nomes conhecidos (ex.: embarcações do gestor).
 * Devolve o nome conhecido encontrado, preferindo o mais longo.
 */
export function encontrarNomeNoTexto(texto: string, conhecidos: string[]): string | null {
  const alvo = ` ${normalizarNome(texto)} `;
  // OCR às vezes separa letras ("DAN IFER"): compara também sem espaços.
  const alvoJunto = alvo.replace(/ /g, '');
  const ordenados = [...conhecidos].filter((n) => normalizarNome(n).length >= 3).sort((x, y) => y.length - x.length);
  for (const nome of ordenados) {
    const n = normalizarNome(nome);
    if (alvo.includes(` ${n} `)) return nome;
    if (n.length >= 5 && alvoJunto.includes(n.replace(/ /g, ''))) return nome;
  }
  return null;
}
