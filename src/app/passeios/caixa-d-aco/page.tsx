import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { bulletListClass, CtaPasseio, Figura, headingClass, LayoutArtigo, marcacao, metadadosPasseio, PorQueBoatzy } from '../_components/Artigo';

export function generateMetadata(): Promise<Metadata> {
  return metadadosPasseio('caixa-d-aco');
}

export default async function CaixaDAcoPage() {
  const t = await getTranslations('ArtigoPasseio.caixa-d-aco');
  return (
    <LayoutArtigo slug="caixa-d-aco" imagem="/images/passeios/caixa-d-aco.png" alt={t('altHero')}>
      <div className="space-y-4">
        <p>{t('intro1')}</p>
        <p>{t('intro2')}</p>
      </div>

      <section>
        <h2 className={headingClass}>{t('baresTitulo')}</h2>
        <p className="mt-4">{t('bares1')}</p>
        <p className="mt-4">{t.rich('bares2', marcacao)}</p>
      </section>

      <Figura src="/images/passeios/caixa-d-aco-02.png" alt={t('altBar')} />

      <section>
        <h2 className={headingClass}>{t('vipTitulo')}</h2>
        <p className="mt-4">{t.rich('vip1', marcacao)}</p>
        <p className="mt-4">{t('vip2')}</p>
        <ul className={bulletListClass}>
          <li>{t.rich('dicaOuro', marcacao)}</li>
          <li>{t.rich('idealPara', marcacao)}</li>
        </ul>
      </section>

      <Figura src="/images/passeios/caixa-d-aco-01.png" alt={t('altBarcos')} />

      <PorQueBoatzy titulo={t('porQueTitulo')} intro={t('porQueIntro')} />

      <CtaPasseio titulo={t('ctaTitulo')} texto={t('ctaTexto')} />
    </LayoutArtigo>
  );
}
