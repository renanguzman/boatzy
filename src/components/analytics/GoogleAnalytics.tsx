import Script from 'next/script';
import { GA_ID } from '@/lib/analytics';
import IdentificarUsuario from './IdentificarUsuario';

/**
 * Google tag (gtag.js) do GA4 — no layout raiz, cobre site, painel e admin.
 * Só carrega em produção (na Vercel, só no ambiente Production: previews e
 * `next dev` não poluem as métricas). Carrega após a hidratação.
 */
export default function GoogleAnalytics() {
  const vercelEnv = process.env.VERCEL_ENV;
  const producao = vercelEnv ? vercelEnv === 'production' : process.env.NODE_ENV === 'production';
  if (!producao || !GA_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
      <IdentificarUsuario />
    </>
  );
}
