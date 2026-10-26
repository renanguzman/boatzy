import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FaqContent from './_components/FaqContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Ajuda');
  return { title: t('metaTitulo'), description: t('metaDescricao') };
}

export default async function HelpPage() {
  const t = await getTranslations('Ajuda');
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-areia">
        {/* Hero */}
        <section className="bg-marinho text-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('titulo')}</h1>
            <p className="mt-3 text-slate-300 max-w-xl mx-auto">{t('subtitulo')}</p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
          <FaqContent />
        </div>
      </main>

      <Footer />
    </div>
  );
}
