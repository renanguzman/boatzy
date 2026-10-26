import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { bulletListClass, CtaPasseio, Figura, headingClass, LayoutArtigo, marcacao, metadadosPasseio } from '../_components/Artigo';

export function generateMetadata(): Promise<Metadata> {
  return metadadosPasseio('ilha-do-campeche', true);
}

export default async function IlhaDoCampechePage() {
  const t = await getTranslations('ArtigoPasseio.ilha-do-campeche');
  return (
    <LayoutArtigo slug="ilha-do-campeche" imagem="/images/passeios/ilha-do-campeche.jpg" alt={t('altHero')}>
      <div className="space-y-4">
        <p>{t.rich('intro1', marcacao)}</p>
        <p>{t('intro2')}</p>
        <p>{t.rich('intro3', marcacao)}</p>
      </div>

      <section>
        <h2 className={headingClass}>{t('acessoTitulo')}</h2>
        <p className="mt-4">{t('acesso1')}</p>
        <p className="mt-4">{t('acesso2')}</p>
      </section>

      <Figura src="/images/passeios/ilha-do-campeche_01.JPG" alt={t('altBarcos')} />

      <section>
        <h2 className={headingClass}>{t('premiumTitulo')}</h2>
        <p className="mt-4">{t.rich('premium1', marcacao)}</p>
        <p className="mt-4">{t.rich('premium2', marcacao)}</p>
        <p className="mt-4">{t('premium3')}</p>
      </section>

      <section>
        <h2 className={headingClass}>{t('porQueTitulo')}</h2>
        <p className="mt-4">{t('porQueIntro')}</p>
        <ul className={bulletListClass}>
          {(['transparencia', 'tudoSobreBarco', 'calendario', 'personalizacao', 'seguranca'] as const).map((chave) => (
            <li key={chave}>{t.rich(`porQue.${chave}`, marcacao)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={headingClass}>{t('fazerTitulo')}</h2>
        <p className="mt-4">{t('fazerIntro')}</p>
        <ol className="mt-4 space-y-3 list-decimal pl-5">
          {(['snorkel', 'churrasco', 'trilhas'] as const).map((chave) => (
            <li key={chave}>{t.rich(`fazer.${chave}`, marcacao)}</li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className={headingClass}>{t('dicasTitulo')}</h2>
        <ul className={bulletListClass}>
          {(['antecedencia', 'vento', 'cedo'] as const).map((chave) => (
            <li key={chave}>{t.rich(`dicas.${chave}`, marcacao)}</li>
          ))}
        </ul>
      </section>

      <CtaPasseio titulo={t('ctaTitulo')} texto={t('ctaTexto')} />
    </LayoutArtigo>
  );
}
