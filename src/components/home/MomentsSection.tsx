'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { moments } from '@/lib/mock-data';
import { PASSEIOS_DESTAQUE } from '@/lib/passeios';

// Os cards da seção: primeiro os passeios com página própria (conteúdo real,
// definido em `passeios.ts`); o restante dos slots segue preenchido pelos
// "moments" antigos até cada um ser substituído por um passeio definitivo.
const ITENS = [
  ...PASSEIOS_DESTAQUE.map((passeio) => ({
    title: passeio.titulo,
    image: passeio.imagem,
    href: `/passeios/${passeio.slug}`,
  })),
  ...moments.slice(PASSEIOS_DESTAQUE.length).map((moment) => ({
    title: moment.title,
    image: moment.image,
    href: undefined as string | undefined,
  })),
];

// Largura de cada card no carrossel: mostra ~4 completos em telas grandes
// (lg) e deixa uma fatia do próximo à mostra, indicando que há mais itens.
const CARD_WIDTH_CLASS = 'w-[78%] sm:w-[44%] lg:w-[22%]';

export default function MomentsSection() {
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
    <section className="py-16 bg-slate-50/50" id="moments-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-10">
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold text-cyan-600 uppercase tracking-widest mb-1">
              Inspire-se
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-[#0B2447]">
              Coleção de{' '}
              <span className="bg-gradient-to-r from-[#0B3D91] to-cyan-500 bg-clip-text text-transparent">
                experiências
              </span>
            </h2>
          </div>

          {ITENS.length > 1 && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollPrev}
                aria-label="Experiência anterior"
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollNext}
                aria-label="Próxima experiência"
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
          {ITENS.map((item, index) => {
            const card = (
              <>
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B2447]/85 via-[#0B2447]/25 to-transparent" />

                {/* Content */}
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <h3 className="text-white font-semibold text-sm md:text-base leading-snug">
                    {item.title}
                  </h3>
                </div>
              </>
            );

            const className = `group relative shrink-0 snap-start rounded-2xl overflow-hidden h-64 md:h-80 ${CARD_WIDTH_CLASS}` +
              (item.href ? ' cursor-pointer' : '');

            return item.href ? (
              <Link key={index} href={item.href} id={`moment-${index}`} className={className}>
                {card}
              </Link>
            ) : (
              <div key={index} id={`moment-${index}`} className={className}>
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
