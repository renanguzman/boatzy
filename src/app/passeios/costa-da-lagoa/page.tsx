import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { bulletListClass, CtaPasseio, Figura, headingClass, LayoutArtigo, marcacao, metadadosPasseio, PorQueBoatzy } from '../_components/Artigo';

export function generateMetadata(): Promise<Metadata> {
  return metadadosPasseio('costa-da-lagoa');
}

export default async function CostaDaLagoaPage() {
  const t = await getTranslations('ArtigoPasseio.costa-da-lagoa');
  return (
    <LayoutArtigo slug="costa-da-lagoa" imagem="/images/passeios/costa-da-lagoa.png" alt={t('altHero')}>
      <p>{t('intro')}</p>

      <section>
        <h2 className={headingClass}>{t('magiaTitulo')}</h2>
        <p className="mt-4">{t('magia1')}</p>
        <p className="mt-4">{t('magia2')}</p>
      </section>

      <section>
        <h2 className={headingClass}>{t('restaurantesTitulo')}</h2>
        <ul className={bulletListClass}>
          {(['cabral', 'ponto16', 'coracao'] as const).map((chave) => (
            <li key={chave}>{t.rich(`restaurantes.${chave}`, marcacao)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={headingClass}>{t('gruposTitulo')}</h2>
        <p className="mt-4">{t('grupos')}</p>
      </section>

      <section>
        <h2 className={headingClass}>{t('navegadorTitulo')}</h2>
        <p className="mt-4">{t('navegador')}</p>
      </section>

      <Figura src="/images/passeios/costa-da-lagoa-01.png" alt={t('altCanal')} />

      <PorQueBoatzy titulo={t('porQueTitulo')} intro={t('porQueIntro')} />

      <CtaPasseio titulo={t('ctaTitulo')} texto={t('ctaTexto')} />
    </LayoutArtigo>
  );
}
