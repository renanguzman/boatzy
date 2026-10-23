import Script from 'next/script';
import { GA_ID } from '@/lib/analytics';
import { COOKIE_CONSENTIMENTO } from '@/lib/consentimento';
import IdentificarUsuario from './IdentificarUsuario';

/**
 * Google tag (gtag.js) do GA4 — no layout raiz, cobre site, painel e admin.
 * Só carrega em produção (na Vercel, só no ambiente Production: previews e
 * `next dev` não poluem as métricas). Carrega após a hidratação.
 *
 * Consent Mode v2 avançado (LGPD, SPEC §66): tudo começa "negado" — sem
 * cookies, o GA só envia sinais anônimos para modelagem. Se o visitante já
 * aceitou a Medição (cookie `boatzy_consentimento`), concede antes do
 * `config`, então a 1ª página já é medida normalmente. Anúncios: sempre negado.
 */
export default function GoogleAnalytics() {
  const vercelEnv = process.env.VERCEL_ENV;
  const producao = vercelEnv ? vercelEnv === 'production' : process.env.NODE_ENV === 'production';
  if (!producao || !GA_ID) return null;

  return (
    <>
      {/* Consentimento ANTES de qualquer medição: o inline vem primeiro na fila do dataLayer. */}
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          gtag('set', 'ads_data_redaction', true);
          try {
            var m = document.cookie.match(/(?:^|; )${COOKIE_CONSENTIMENTO}=([^;]*)/);
            var c = m && JSON.parse(decodeURIComponent(m[1]));
            if (c && c.medicao === true) gtag('consent', 'update', { analytics_storage: 'granted' });
          } catch (e) {}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <IdentificarUsuario />
    </>
  );
}
