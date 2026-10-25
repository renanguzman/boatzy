/**
 * Regras de uso da embarcação (`embarcacao.regras`, text[]) — normalização compartilhada pelo
 * campo de tags do painel e pelas actions que gravam (o servidor não confia no que chega).
 */

/** Teto de itens (o banco também limita: CHECK cardinality(regras) <= 20). */
export const MAX_REGRAS = 20;
/** Teto de caracteres por regra. */
export const MAX_CARACTERES_REGRA = 120;

/** Uma regra: sem espaços nas pontas nem repetidos, cortada no teto de caracteres. */
export function normalizarRegra(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().slice(0, MAX_CARACTERES_REGRA).trim();
}

/** Quebra um texto colado/digitado em regras: separa por ponto e vírgula ou quebra de linha. */
export function separarRegras(texto: string): string[] {
  return texto.split(/[;\n]/).map(normalizarRegra).filter(Boolean);
}

/** Lista final: só textos, normalizados, sem vazias nem duplicadas (sem diferenciar caixa), até MAX_REGRAS. */
export function normalizarRegras(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const item of lista) {
    if (typeof item !== 'string') continue;
    const regra = normalizarRegra(item);
    const chave = regra.toLocaleLowerCase('pt-BR');
    if (!regra || vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(regra);
    if (saida.length === MAX_REGRAS) break;
  }
  return saida;
}
