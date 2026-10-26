import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CtaPasseio, headingClass, LayoutArtigo, metadadosPasseio, PorQueBoatzy } from '../_components/Artigo';

export function generateMetadata(): Promise<Metadata> {
  return metadadosPasseio('praia-de-palmas');
}

export default async function PraiaDePalmasPage() {
  const t = await getTranslations('ArtigoPasseio.praia-de-palmas');
  return (
    <LayoutArtigo slug="praia-de-palmas" imagem="/images/passeios/praia-de-palmas.png" alt={t('altHero')}>
      <p>{t('intro')}</p>

      <section>
        <h2 className={headingClass}>{t('bandeiraTitulo')}</h2>
        <p className="mt-4">{t('bandeira1')}</p>
        <p className="mt-4">{t('bandeira2')}</p>
      </section>

      <section>
        <h2 className={headingClass}>{t('navegadorTitulo')}</h2>
        <p className="mt-4">{t('navegador')}</p>
      </section>

      <PorQueBoatzy titulo={t('porQueTitulo')} intro={t('porQueIntro')} />

      <CtaPasseio titulo={t('ctaTitulo')} texto={t('ctaTexto')} />
    </LayoutArtigo>
  );
}
