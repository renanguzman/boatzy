import type { RoteiroCardData } from '@/app/buscar/_components/RoteiroCard';

/** Minúsculo e sem acento: "Caixa D'Aço" → "caixa d'aco". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function textoPesquisavel(r: RoteiroCardData, tipoTraduzido: string | null): string {
  return normalizar(
    [
      r.nome,
      r.descricao,
      r.municipios?.nome,
      r.municipios?.estados?.uf,
      r.embarcacao?.embarcacao_tipo?.nome,
      tipoTraduzido,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/**
 * Filtro local da vitrine da home: todas as palavras do termo precisam
 * aparecer em nome, descrição, cidade/UF ou tipo de embarcação. Termo vazio →
 * lista inteira.
 */
export function filtrarRoteiros<T extends RoteiroCardData>(
  roteiros: T[],
  termo: string,
  traduzirTipo: (nome: string) => string,
): T[] {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return roteiros;
  return roteiros.filter((r) => {
    const tipo = r.embarcacao?.embarcacao_tipo?.nome;
    const alvo = textoPesquisavel(r, tipo ? traduzirTipo(tipo) : null);
    return palavras.every((p) => alvo.includes(p));
  });
}

/** "Florianópolis, SC" / "Florianópolis, SC e Porto Belo, SC" — cidades de saída distintas. */
export function cidadesDeSaida(roteiros: RoteiroCardData[]): string[] {
  const vistas = new Set<string>();
  for (const r of roteiros) {
    if (!r.municipios) continue;
    const uf = r.municipios.estados?.uf;
    vistas.add(uf ? `${r.municipios.nome}, ${uf}` : r.municipios.nome);
  }
  return [...vistas];
}
