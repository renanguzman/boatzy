import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Phone, MapPin } from 'lucide-react';
import { gerarDesafioCaptcha } from '@/lib/contato-captcha';
import ContactForm from './_components/ContactForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Contato');
  return { title: t('metaTitulo'), description: t('metaDescricao') };
}

export default async function ContactPage() {
  const desafio = gerarDesafioCaptcha();
  const [t, idioma] = await Promise.all([getTranslations('Contato'), getLocale()]);

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

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Formulário */}
            <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <ContactForm desafioInicial={desafio} />
            </div>

            {/* Info lateral */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-marinho/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-marinho" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-marinho">{t('suporte')}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{t('prazo')}</p>
                    {idioma !== 'pt-BR' && <p className="text-xs text-slate-400 mt-2">{t('aviso')}</p>}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-marinho/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-marinho" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-marinho">Boatzy</p>
                    <p className="text-sm text-slate-500 mt-0.5">{t('slogan')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
