import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CtaPasseio, Figura, headingClass, LayoutArtigo, metadadosPasseio, PorQueBoatzy } from '../_components/Artigo';

export function generateMetadata(): Promise<Metadata> {
  return metadadosPasseio('praia-do-tingua');
}

export default async function PraiaDoTinguaPage() {
  const t = await getTranslations('ArtigoPasseio.praia-do-tingua');
  return (
    <LayoutArtigo slug="praia-do-tingua" imagem="/images/passeios/praia-do-tingua.png" alt={t('altHero')}>
      <p>{t('intro')}</p>

      <section>
        <h2 className={headingClass}>{t('clubeTitulo')}</h2>
        <p className="mt-4">{t('clube1')}</p>
        <p className="mt-4">{t('clube2')}</p>
      </section>

      <Figura src="/images/passeios/praia-do-tingua-01.png" alt={t('altBarcos')} />

      <section>
        <h2 className={headingClass}>{t('gastronomiaTitulo')}</h2>
        <p className="mt-4">{t('gastronomia')}</p>
      </section>

      <section>
        <h2 className={headingClass}>{t('lemeTitulo')}</h2>
        <p className="mt-4">{t('leme')}</p>
      </section>

      <PorQueBoatzy titulo={t('porQueTitulo')} intro={t('porQueIntro')} />

      <CtaPasseio titulo={t('ctaTitulo')} texto={t('ctaTexto')} />
    </LayoutArtigo>
  );
}
