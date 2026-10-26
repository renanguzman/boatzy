/**
 * Idiomas do site (SPEC §94). pt-BR é o padrão e a fonte das traduções
 * (`messages/pt-BR`); en-US e es são traduções completas dela.
 *
 * O idioma não vai na URL: fica no cookie `NEXT_LOCALE` (escolha explícita no
 * seletor do Header) ou sai do `Accept-Language` do navegador. Painel e
 * administrador ficam sempre em pt-BR — o proxy marca essas rotas com
 * `HEADER_AREA` (ver `src/proxy.ts` e `src/i18n/request.ts`).
 *
 * Sem dependências de servidor: usado também no proxy e em componentes cliente.
 */

export const IDIOMAS = ['pt-BR', 'en-US', 'es'] as const;

export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_PADRAO: Idioma = 'pt-BR';

/** Cookie da escolha explícita (nome padrão do next-intl). */
export const COOKIE_IDIOMA = 'NEXT_LOCALE';

/** Opções do cookie (validade de 1 ano) — seletor do Header e login (setup-cliente). */
export const OPCOES_COOKIE_IDIOMA = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
} as const;

/** Header que o proxy põe nas rotas de `/painel` e `/administrator` (valor `interno`). */
export const HEADER_AREA = 'x-boatzy-area';

/** Rotas travadas em pt-BR: painel do gestor, área administrativa e suas APIs. */
export function isRotaInterna(pathname: string): boolean {
  return /^\/(painel|administrator|api\/painel)(\/|$)/.test(pathname);
}

export function isIdioma(valor: unknown): valor is Idioma {
  return typeof valor === 'string' && (IDIOMAS as readonly string[]).includes(valor);
}

/** Nome de cada idioma na própria língua (seletor do Header) e a sigla curta. */
export const NOMES_IDIOMA: Record<Idioma, { nome: string; sigla: string }> = {
  'pt-BR': { nome: 'Português (Brasil)', sigla: 'PT' },
  'en-US': { nome: 'English (US)', sigla: 'EN' },
  es: { nome: 'Español', sigla: 'ES' },
};

/**
 * Locale passado ao `Intl` (números, moeda, datas). O espanhol do site é o
 * latino-americano neutro; a formatação segue o padrão rioplatense do público
 * principal (`R$ 1.500`, `30/10/2026`) — `es` puro formata moeda como "1500 BRL".
 */
export const LOCALE_INTL: Record<Idioma, string> = {
  'pt-BR': 'pt-BR',
  'en-US': 'en-US',
  es: 'es-AR',
};

/** `og:locale` (formato `ll_CC`). */
export const LOCALE_OPEN_GRAPH: Record<Idioma, string> = {
  'pt-BR': 'pt_BR',
  'en-US': 'en_US',
  es: 'es_LA',
};

/**
 * Primeiro idioma suportado do `Accept-Language`, respeitando os pesos `q`
 * (ex.: `es-AR,es;q=0.9,en;q=0.8` → `es`). Qualquer variante regional cai no
 * idioma do site (`en-GB` → en-US, `pt-PT` → pt-BR). `null` se nenhum servir.
 */
export function idiomaDoAcceptLanguage(header: string | null | undefined): Idioma | null {
  if (!header) return null;
  const preferidos = header
    .split(',')
    .map((parte, ordem) => {
      const [tag, ...params] = parte.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1, ordem };
    })
    .filter((p) => p.tag && p.q > 0)
    .sort((a, b) => b.q - a.q || a.ordem - b.ordem);

  for (const { tag } of preferidos) {
    const base = tag.split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en') return 'en-US';
    if (base === 'es') return 'es';
  }
  return null;
}
