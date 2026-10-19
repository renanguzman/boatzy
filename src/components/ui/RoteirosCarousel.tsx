'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import RoteiroCard, { type RoteiroCardData, type AvaliacaoResumoCard } from '@/app/buscar/_components/RoteiroCard';
import type { PrecoNaData } from '@/lib/precos-roteiro';

export type RoteiroCarouselItem = {
  roteiro: RoteiroCardData;
  initialFavorito: boolean;
  avaliacaoResumo: AvaliacaoResumoCard | null;
  /** Preço na data da busca (ver `RoteiroCard`); null = "a partir de". */
  precoNaData?: PrecoNaData | null;
};

// Mesma proporção do carrossel "Coleção de experiências" da home: ~4 cards em
// telas grandes (lg) com uma fatia do próximo à mostra, indicando que há mais.
const CARD_WIDTH_CLASS = 'w-[78%] sm:w-[44%] lg:w-[22%]';

export default function RoteirosCarousel({
  title,
  items,
  query,
}: {
  title?: string;
  items: RoteiroCarouselItem[];
  /** Querystring (sem '?') repassada ao detalhe do roteiro para pré-preencher data/pessoas. */
  query?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(items.length > 1);

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
  }, [items.length]);

  function scroll(direction: 'left' | 'right') {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        {title && <h2 className="text-xl font-bold text-[#0B2447]">{title}</h2>}
        {items.length > 1 && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollPrev}
              aria-label="Roteiro anterior"
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollNext}
              aria-label="Próximo roteiro"
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl">
          Esta embarcação não tem roteiros ativos no momento.
        </p>
      ) : (
        <div
          ref={scrollerRef}
          // scroll-px-4: no mobile o container sangra até a borda (-mx-4 px-4);
          // sem o scroll-padding o snap encostaria o 1º card na borda da tela.
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0"
        >
          {items.map(({ roteiro, initialFavorito, avaliacaoResumo, precoNaData }) => (
            <div key={roteiro.id} className={`shrink-0 snap-start ${CARD_WIDTH_CLASS}`}>
              <RoteiroCard
                roteiro={roteiro}
                query={query}
                precoNaData={precoNaData}
                initialFavorito={initialFavorito}
                avaliacaoResumo={avaliacaoResumo}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
