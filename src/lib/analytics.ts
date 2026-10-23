/**
 * Google Analytics 4 (gtag.js) — helpers do lado do browser (SPEC §65).
 *
 * A tag é carregada em `src/components/analytics/GoogleAnalytics.tsx` (layout
 * raiz → site, painel e admin). Page views de navegação são automáticos
 * (medição otimizada do GA4: "mudanças de página baseadas em eventos do
 * histórico"). Aqui ficam os eventos do funil e a identificação do usuário.
 * Sem a tag carregada (dev, preview), tudo vira no-op.
 */

/** ID de medição. Público por natureza; `NEXT_PUBLIC_GA_ID` permite trocar sem deploy de código. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-4QJF8H6EDJ';

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | null {
  if (typeof window === 'undefined') return null;
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  return typeof g === 'function' ? g : null;
}

/**
 * Executa com o gtag disponível. A tag carrega após a hidratação, então
 * eventos disparados no primeiro render esperam até ~6 s; sem tag (dev,
 * preview), desistem em silêncio.
 */
function quandoPronto(fn: (g: Gtag) => void, tentativas = 20): void {
  if (typeof window === 'undefined') return;
  const g = gtag();
  if (g) {
    try {
      fn(g);
    } catch {
      // analytics nunca quebra a página
    }
    return;
  }
  if (tentativas > 0) setTimeout(() => quandoPronto(fn, tentativas - 1), 300);
}

/** Área do sistema pela URL — vai como parâmetro em todo evento personalizado. */
export function areaAtual(): 'painel' | 'admin' | 'site' {
  if (typeof window === 'undefined') return 'site';
  const p = window.location.pathname;
  if (p.startsWith('/painel')) return 'painel';
  if (p.startsWith('/administrator')) return 'admin';
  return 'site';
}

/** Envia um evento ao GA4 (nunca lança). */
export function rastrear(evento: string, params: Record<string, unknown> = {}): void {
  const area = areaAtual();
  quandoPronto((g) => g('event', evento, { area, ...params }));
}

/**
 * Envia o evento uma única vez por navegador (ex.: `purchase` ao reabrir a
 * página do pedido pago). Sem localStorage disponível, envia normalmente.
 */
export function rastrearUmaVez(chave: string, evento: string, params: Record<string, unknown> = {}): void {
  const k = `ga:${chave}`;
  try {
    if (window.localStorage.getItem(k)) return;
    window.localStorage.setItem(k, '1');
  } catch {
    // segue sem deduplicar
  }
  rastrear(evento, params);
}

export type PerfilAnalytics = 'admin' | 'gestor' | 'cliente' | 'visitante';

/**
 * Identifica o usuário logado (User-ID = uuid, nunca e-mail/nome) e o perfil.
 * Admin vira tráfego interno (`traffic_type: internal`) — o filtro
 * "Internal Traffic" do GA4 o exclui dos relatórios quando ativado.
 */
export function identificarUsuario(userId: string | null, perfil: PerfilAnalytics): void {
  quandoPronto((g) => {
    g('set', { user_id: userId ?? null });
    g('set', 'user_properties', { perfil });
    if (perfil === 'admin') g('set', { traffic_type: 'internal' });
  });
}
