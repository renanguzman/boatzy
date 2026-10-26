'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PASSEIOS_DESTAQUE } from '@/lib/passeios';

// Os cards da seção: os passeios com página própria (conteúdo editorial em
// `passeios.ts`; título no idioma do site em `Passeios.<slug>`).
const ITENS = PASSEIOS_DESTAQUE;

// Largura de cada card no carrossel: mostra ~4 completos em telas grandes
// (lg) e deixa uma fatia do próximo à mostra, indicando que há mais itens.
const CARD_WIDTH_CLASS = 'w-[78%] sm:w-[44%] lg:w-[22%]';

export default function MomentsSection() {
  const t = useTranslations('Home.experiencias');
  const tPasseios = useTranslations('Passeios');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(ITENS.length > 1);

  function updateScrollState() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  function scroll(direction: 'left' | 'right') {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  return (
    <section className="py-16 bg-areia" id="moments-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-10">
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold text-turquesa-escuro uppercase tracking-widest mb-1">
              {t('sobretitulo')}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-marinho">
              {t.rich('titulo', { destaque: (texto) => <span className="bg-gradient-to-r from-marinho to-turquesa bg-clip-text text-transparent">{texto}</span> })}
            </h2>
          </div>

          {ITENS.length > 1 && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollPrev}
                aria-label={t('anterior')}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollNext}
                aria-label={t('proxima')}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Carrossel */}
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {ITENS.map((passeio, index) => {
            const titulo = tPasseios(`${passeio.slug}.titulo`);
            const card = (
              <>
                <Image
                  src={passeio.imagem}
                  alt={titulo}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-marinho/85 via-marinho/25 to-transparent" />

                {/* Content */}
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <h3 className="text-white font-semibold text-sm md:text-base leading-snug">
                    {titulo}
                  </h3>
                </div>
              </>
            );

            return (
              <Link
                key={passeio.slug}
                href={`/passeios/${passeio.slug}`}
                id={`moment-${index}`}
                className={`group relative shrink-0 snap-start rounded-2xl overflow-hidden h-64 md:h-80 cursor-pointer ${CARD_WIDTH_CLASS}`}
              >
                {card}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
