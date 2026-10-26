import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import type { SlugPasseio } from '@/lib/passeios';

/**
 * Peças comuns dos artigos de /passeios/* (SPEC §94.11). O texto vem de
 * `ArtigoPasseio.<slug>` (passeios-artigos.json) com marcação <b>/<em> via `t.rich`.
 */

export const headingClass = 'text-2xl sm:text-3xl font-bold text-marinho';
export const bulletListClass = 'mt-4 space-y-3 list-disc pl-5';

/** Tags aceitas no texto rico dos artigos. */
export const marcacao = {
  b: (texto: ReactNode) => <strong>{texto}</strong>,
  em: (texto: ReactNode) => <em>{texto}</em>,
};

/** Título "<título do passeio> — Boatzy" e descrição no idioma. */
export async function metadadosPasseio(slug: SlugPasseio, tituloProprio = false): Promise<Metadata> {
  const [t, tPasseios] = await Promise.all([getTranslations('ArtigoPasseio'), getTranslations('Passeios')]);
  const titulo = tituloProprio && slug === 'ilha-do-campeche'
    ? t('ilha-do-campeche.metaTitulo')
    : tPasseios(`${slug}.titulo`);
  return { title: t('sufixoTitulo', { titulo }), description: t(`${slug}.metaDescricao`) };
}

export async function LayoutArtigo({
  slug,
  imagem,
  alt,
  children,
}: {
  slug: SlugPasseio;
  imagem: string;
  alt: string;
  children: ReactNode;
}) {
  const tPasseios = await getTranslations('Passeios');
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white">
        {/* Hero */}
        <section className="relative h-[50vh] min-h-[360px] flex items-end">
          <Image src={imagem} alt={alt} fill priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-marinho/90 via-marinho/30 to-transparent" />
          <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">{tPasseios(`${slug}.titulo`)}</h1>
          </div>
        </section>

        {/* Conteúdo */}
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-slate-700 leading-relaxed space-y-8">
          {children}
        </article>
      </main>

      <Footer />
    </div>
  );
}

/** Imagem no meio do artigo. */
export function Figura({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden">
      <Image src={src} alt={alt} fill className="object-cover" />
    </figure>
  );
}

/** "Por que escolher o Boatzy?" — lista padrão de 6 vantagens (`ArtigoPasseio.porQue`). */
export async function PorQueBoatzy({ titulo, intro }: { titulo: string; intro: string }) {
  const t = await getTranslations('ArtigoPasseio.porQue');
  return (
    <section>
      <h2 className={headingClass}>{titulo}</h2>
      <p className="mt-4">{intro}</p>
      <ul className={bulletListClass}>
        {(['transparencia', 'tudoSobreBarco', 'calendario', 'personalize', 'cancelamento', 'pagamento'] as const).map((chave) => (
          <li key={chave}>{t.rich(chave, marcacao)}</li>
        ))}
      </ul>
    </section>
  );
}

/** CTA final para a busca. */
export async function CtaPasseio({ titulo, texto }: { titulo: string; texto: string }) {
  const t = await getTranslations('ArtigoPasseio');
  return (
    <div className="rounded-2xl bg-marinho text-center px-6 py-10 sm:px-12">
      <p className="text-white text-lg font-semibold italic">{titulo}</p>
      <p className="mt-3 text-slate-300">{texto}</p>
      <Link
        href="/buscar"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-marinho text-sm font-semibold px-6 py-3 transition-colors"
      >
        {t('buscarEmbarcacoes')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
