import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { Compass, Ship, Sparkles, Waves, ShieldCheck, ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Sobre');
  return { title: t('metaTitulo'), description: t('metaDescricao') };
}

const headingClass = 'text-2xl sm:text-3xl md:text-4xl font-bold text-marinho leading-tight';
const proseClass = 'mt-6 space-y-5 text-slate-600 leading-relaxed text-base sm:text-lg';

const PRINCIPIOS = [
  { icon: Sparkles, id: 'simplicidade' },
  { icon: Waves, id: 'acesso' },
  { icon: ShieldCheck, id: 'confianca' },
] as const;

export default async function SobrePage() {
  const t = await getTranslations('Sobre');
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative min-h-[60vh] flex items-center">
          <Image
            src="/images/hero-yacht.png"
            alt={t('altHero')}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-marinho/95 via-marinho/75 to-marinho/40" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
            <div className="max-w-2xl">
              <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
                {t('heroTitulo')}
              </h1>
              <p className="mt-6 text-lg text-slate-200 leading-relaxed">{t('heroTexto')}</p>
            </div>
          </div>
        </section>

        {/* Seção 1 */}
        <section className="py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className={headingClass}>{t('origem.titulo')}</h2>
            <div className={proseClass}>
              {(['p1', 'p2', 'p3', 'p4', 'p5'] as const).map((p) => (
                <p key={p}>{t(`origem.${p}`)}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Seção 2 */}
        <section className="py-16 md:py-24 bg-areia">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className={`${headingClass} text-center`}>{t('ladosTitulo')}</h2>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                <div className="h-12 w-12 rounded-xl bg-marinho/10 flex items-center justify-center mb-5">
                  <Compass className="h-6 w-6 text-marinho" />
                </div>
                <h3 className="text-lg font-bold text-marinho mb-3">{t('navegar.titulo')}</h3>
                <p className="text-slate-600 leading-relaxed">{t('navegar.texto')}</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                <div className="h-12 w-12 rounded-xl bg-marinho/10 flex items-center justify-center mb-5">
                  <Ship className="h-6 w-6 text-marinho" />
                </div>
                <h3 className="text-lg font-bold text-marinho mb-3">{t('proprietario.titulo')}</h3>
                <p className="text-slate-600 leading-relaxed">{t('proprietario.texto')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 3 */}
        <section className="py-16 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0">
                <Image src="/images/benefits-bg.png" alt="" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-marinho/95 via-marinho/92 to-marinho/95" />
              </div>

              <div className="relative z-10 p-8 md:p-12 lg:p-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-12">
                  {t('principiosTitulo')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {PRINCIPIOS.map(({ icon: Icon, id }) => (
                    <div
                      key={id}
                      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6"
                    >
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-turquesa/25 to-turquesa/10 flex items-center justify-center mb-4">
                        <Icon className="h-5 w-5 text-turquesa" />
                      </div>
                      <p className="text-white text-base font-semibold mb-2">{t(`principios.${id}.titulo`)}</p>
                      <p className="text-slate-300 text-sm leading-relaxed">{t(`principios.${id}.texto`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 4 */}
        <section className="py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className={headingClass}>{t('expansao.titulo')}</h2>
            <div className={proseClass}>
              <p>{t('expansao.p1')}</p>
              <p>{t('expansao.p2')}</p>
              <p className="font-semibold text-marinho">{t('expansao.p3')}</p>
            </div>
          </div>
        </section>

        {/* Chamada final */}
        <section className="py-16 md:py-24 bg-marinho">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12">{t('ctaTitulo')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 flex flex-col">
                <p className="text-white text-lg font-medium leading-snug flex-1">
                  {t('ctaNavegar')}
                </p>
                <Link
                  href="/buscar"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-marinho text-sm font-semibold px-6 py-3 transition-colors"
                >
                  {t('ctaVerEmbarcacoes')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 flex flex-col">
                <p className="text-white text-lg font-medium leading-snug flex-1">
                  {t('ctaAnunciar')}
                </p>
                <Link
                  href="/painel/login"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-turquesa hover:brightness-110 text-marinho text-sm font-semibold px-6 py-3 transition-all"
                >
                  {t('ctaQueroAnunciar')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <p className="mt-12 text-sm text-slate-400">
              {t('contato')}{' '}
              <a href="mailto:adm@boatzy.app" className="text-slate-300 underline hover:text-white">
                {'adm@boatzy.app'}
              </a>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
