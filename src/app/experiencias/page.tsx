import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { PASSEIOS_DESTAQUE } from '@/lib/passeios';

export const metadata: Metadata = {
  title: 'Experiências — Boatzy',
  description:
    'Roteiros, destinos e histórias para inspirar seu próximo passeio de barco: conheça os melhores lugares para navegar com o Boatzy.',
};

export default function ExperienciasPage() {
  const [destaque, ...resto] = PASSEIOS_DESTAQUE;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="bg-[#0B2447] text-white">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 text-center">
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-2">
              Inspire-se
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Experiências{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
                para navegar
              </span>
            </h1>
            <p className="mt-3 text-slate-300 max-w-xl mx-auto">
              Roteiros, destinos e histórias reais para te ajudar a escolher o próximo passeio de
              barco — direto de quem conhece o litoral catarinense.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {/* Destaque */}
          {destaque && (
            <Link
              href={`/passeios/${destaque.slug}`}
              className="group grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow p-3 md:p-4"
            >
              <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden">
                <Image
                  src={destaque.imagem}
                  alt={destaque.titulo}
                  fill
                  priority
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="pr-2 md:pr-6 pb-2 md:pb-4">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B3D91] bg-[#0B3D91]/10 px-3 py-1 rounded-full">
                  <MapPin className="h-3.5 w-3.5" />
                  {destaque.local}
                </span>
                <h2 className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold text-[#0B2447] leading-snug group-hover:text-[#0B3D91] transition-colors">
                  {destaque.titulo}
                </h2>
                <p className="mt-3 text-slate-600 leading-relaxed">{destaque.resumo}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B3D91]">
                  Ler experiência
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          )}

          {/* Grid dos demais */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {resto.map((passeio) => (
              <Link
                key={passeio.slug}
                href={`/passeios/${passeio.slug}`}
                className="group flex flex-col rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="relative h-52 overflow-hidden">
                  <Image
                    src={passeio.imagem}
                    alt={passeio.titulo}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B3D91] bg-[#0B3D91]/10 px-2.5 py-1 rounded-full self-start">
                    <MapPin className="h-3 w-3" />
                    {passeio.local}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-[#0B2447] leading-snug group-hover:text-[#0B3D91] transition-colors">
                    {passeio.titulo}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">
                    {passeio.resumo}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B3D91]">
                    Ler experiência
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* CTA final */}
          <div className="mt-16 rounded-3xl bg-[#0B2447] text-white p-8 sm:p-10 text-center">
            <h2 className="text-xl sm:text-2xl font-bold">Pronto para viver a sua?</h2>
            <p className="mt-2 text-slate-300 max-w-lg mx-auto">
              Encontre a embarcação certa e reserve o roteiro que combina com a experiência que
              você quer viver.
            </p>
            <Link
              href="/buscar"
              className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-[#0B3D91] to-cyan-500 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:brightness-110 transition-all"
            >
              Buscar embarcações
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
