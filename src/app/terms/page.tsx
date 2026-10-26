import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CabecalhoLegal from '@/components/legal/CabecalhoLegal';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('TermosUso');
  return { title: t('metaTitulo'), description: t('metaDescricao') };
}

const tituloClass = 'text-xl font-semibold text-grafite';
const listaClass = 'mt-3 list-disc space-y-1 pl-5';

const marcacao = {
  b: (texto: ReactNode) => <strong>{texto}</strong>,
  em: (texto: ReactNode) => <em>{texto}</em>,
  privacidade: (texto: ReactNode) => (
    <Link href="/privacy" className="text-marinho underline hover:no-underline">{texto}</Link>
  ),
};

export default async function TermsPage() {
  const t = await getTranslations('TermosUso');
  const r = (chave: Parameters<typeof t.rich>[0]) => t.rich(chave, marcacao);

  return (
    <>
      <Header />

      <main className="flex-1 bg-areia">
        <CabecalhoLegal titulo={t('titulo')} atualizadoEm="2026-06-21" />

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Aviso de status */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{r('status')}</p>
          </div>

          <article className="mt-10 space-y-10 text-slate-700 leading-relaxed">
            <section>
              <h2 className={tituloClass}>{t('s1.titulo')}</h2>
              <p className="mt-3">{r('s1.p1')}</p>
              <p className="mt-3">{r('s1.p2')}</p>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s2.titulo')}</h2>
              <p className="mt-3">{r('s2.p1')}</p>
              <ul className={listaClass}>
                <li>{r('s2.anunciantes')}</li>
                <li>{r('s2.locatarios')}</li>
              </ul>
              <p className="mt-3">{r('s2.p2')}</p>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s3.titulo')}</h2>
              <p className="mt-3">{t('s3.p1')}</p>
              <ul className={listaClass}>
                <li>{r('s3.i1')}</li>
                <li>{r('s3.i2')}</li>
                <li>{t('s3.i3')}</li>
              </ul>
              <p className="mt-3">{r('s3.p2')}</p>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s4.titulo')}</h2>
              <p className="mt-3 font-medium text-grafite">{t('s4.anunciantes')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('s4.a1')}</li>
                <li>{t('s4.a2')}</li>
                <li>{t('s4.a3')}</li>
              </ul>
              <p className="mt-3 font-medium text-grafite">{t('s4.locatarios')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('s4.l1')}</li>
                <li>{t('s4.l2')}</li>
                <li>{t('s4.l3')}</li>
              </ul>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s5.titulo')}</h2>
              <p className="mt-3">{r('s5.p1')}</p>
              <ul className={listaClass}>
                {(['i1', 'i2', 'i3', 'i4', 'i5'] as const).map((i) => <li key={i}>{t(`s5.${i}`)}</li>)}
              </ul>
              <p className="mt-3">{t('s5.p2')}</p>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s6.titulo')}</h2>
              <blockquote className="mt-3 border-l-4 border-slate-300 pl-4 italic text-slate-600">
                {r('s6.nota')}
              </blockquote>
            </section>

            <section>
              <h2 className={tituloClass}>{t('s7.titulo')}</h2>
              <p className="mt-3">{t('s7.p1')}</p>
              <ul className={listaClass}>
                {(['i1', 'i2', 'i3'] as const).map((i) => <li key={i}>{t(`s7.${i}`)}</li>)}
              </ul>
            </section>

            {(['s8', 's9', 's10', 's11', 's12', 's13'] as const).map((s) => (
              <section key={s}>
                <h2 className={tituloClass}>{t(`${s}.titulo`)}</h2>
                <p className="mt-3">{r(`${s}.p`)}</p>
              </section>
            ))}

            <section>
              <h2 className={tituloClass}>{t('s14.titulo')}</h2>
              <p className="mt-3">{t('s14.p')}</p>
              <p className="mt-3">
                {'📧 '}
                <a
                  href="mailto:adm@boatzy.app"
                  className="font-semibold text-marinho underline hover:no-underline"
                >
                  {'adm@boatzy.app'}
                </a>
              </p>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}
