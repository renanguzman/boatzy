import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('Erros.naoEncontrada'))('metaTitulo') };
}

/** 404 do site no idioma (SPEC §94.11) — `notFound()` e URLs sem rota. */
export default async function NotFound() {
  const t = await getTranslations('Erros.naoEncontrada');
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-areia flex items-center">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-marinho/10">
            <Compass className="h-8 w-8 text-marinho" />
          </div>
          <p className="text-sm font-semibold text-turquesa-escuro">{'404'}</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-marinho">{t('titulo')}</h1>
          <p className="mt-3 text-slate-500">{t('texto')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="px-5 py-2.5 rounded-xl bg-marinho hover:bg-marinho-escuro text-white text-sm font-semibold transition-colors">
              {t('inicio')}
            </Link>
            <Link href="/buscar" className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-marinho text-sm font-semibold transition-colors">
              {t('buscar')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
