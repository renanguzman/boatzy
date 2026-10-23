/**
 * Consentimento de cookies (LGPD) — lado do browser (SPEC §66).
 *
 * Categorias: Necessários (sempre ativos) e Medição (Google Analytics,
 * opt-in). A escolha fica no cookie próprio `boatzy_consentimento` e é
 * registrada no banco como evidência (`registrarConsentimento`). O GA roda
 * em Consent Mode v2 avançado: começa "negado" (script inline em
 * `GoogleAnalytics.tsx`, que também lê este cookie) e só grava cookies após
 * o aceite.
 */

export const COOKIE_CONSENTIMENTO = 'boatzy_consentimento';
/** Versão da Política de Privacidade/cookies vigente — vai junto da escolha como evidência. */
export const VERSAO_POLITICA_COOKIES = '2026-10-23';
/** Validade do cookie; renovada a cada visita — quem já escolheu não vê o banner de novo. */
const VALIDADE_DIAS = 365;
/** Evento de janela disparado quando a escolha muda (banner, Minha conta). */
export const EVENTO_CONSENTIMENTO = 'boatzy:consentimento';

export type Consentimento = {
  /** id anônimo do navegador (liga as escolhas no registro). */
  id: string;
  medicao: boolean;
  /** versão da política aceita */
  v: string;
  /** ISO da escolha */
  em: string;
};

function lerCookieBruto(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_CONSENTIMENTO}=([^;]*)`));
  return m ? m[1] : null;
}

export function parseConsentimento(bruto: string | null): Consentimento | null {
  if (!bruto) return null;
  try {
    const c = JSON.parse(decodeURIComponent(bruto)) as Partial<Consentimento>;
    if (typeof c.id !== 'string' || typeof c.medicao !== 'boolean') return null;
    return { id: c.id, medicao: c.medicao, v: c.v ?? '', em: c.em ?? '' };
  } catch {
    return null;
  }
}

export function lerConsentimento(): Consentimento | null {
  return parseConsentimento(lerCookieBruto());
}

/** Para `useSyncExternalStore`: valor bruto do cookie (string estável entre leituras). */
export function snapshotConsentimento(): string {
  return lerCookieBruto() ?? '';
}

export function assinarConsentimento(cb: () => void): () => void {
  window.addEventListener(EVENTO_CONSENTIMENTO, cb);
  return () => window.removeEventListener(EVENTO_CONSENTIMENTO, cb);
}

function novoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function gravarCookie(c: Consentimento): void {
  const seguro = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_CONSENTIMENTO}=${encodeURIComponent(JSON.stringify(c))}; Max-Age=${VALIDADE_DIAS * 86400}; Path=/; SameSite=Lax${seguro}`;
}

/** Renova a validade (chamado a cada visita) sem alterar a escolha. */
export function renovarConsentimento(): void {
  const c = lerConsentimento();
  if (c) gravarCookie(c);
}

type Gtag = (...args: unknown[]) => void;

/** Aplica a escolha no Consent Mode do GA (sem anúncios: os sinais de ads ficam sempre negados). */
function aplicarNoGA(medicao: boolean): void {
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof g !== 'function') return; // tag não carregada (dev/preview): o script inline lê o cookie depois
  g('consent', 'update', { analytics_storage: medicao ? 'granted' : 'denied' });
}

/** Apaga os cookies do GA (`_ga`, `_ga_<ID>`) em todos os domínios possíveis do host. */
function apagarCookiesGA(): void {
  const nomes = document.cookie
    .split('; ')
    .map((c) => c.split('=')[0])
    .filter((n) => n === '_ga' || n.startsWith('_ga_') || n === '_gid');
  const partes = window.location.hostname.split('.');
  const dominios = [''];
  for (let i = 0; i < partes.length - 1; i++) dominios.push(`; Domain=.${partes.slice(i).join('.')}`);
  for (const nome of nomes) {
    for (const d of dominios) document.cookie = `${nome}=; Max-Age=0; Path=/${d}`;
  }
}

/**
 * Salva a escolha (cookie), aplica no GA, avisa a página e devolve o
 * registro a enviar ao servidor. Recusar apaga os cookies do GA na hora.
 */
export function salvarConsentimento(medicao: boolean): Consentimento {
  const atual = lerConsentimento();
  const c: Consentimento = { id: atual?.id ?? novoId(), medicao, v: VERSAO_POLITICA_COOKIES, em: new Date().toISOString() };
  gravarCookie(c);
  aplicarNoGA(medicao);
  if (!medicao) apagarCookiesGA();
  window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));
  return c;
}
