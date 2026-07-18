'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import RoteiroCard, { type RoteiroCardData, type AvaliacaoResumoCard } from '@/app/buscar/_components/RoteiroCard';

export type RoteiroCarouselItem = {
  roteiro: RoteiroCardData;
  initialFavorito: boolean;
  avaliacaoResumo: AvaliacaoResumoCard | null;
};

const SCROLL_AMOUNT = 320;

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

  function scroll(direction: 'left' | 'right') {
    scrollerRef.current?.scrollBy({ left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        {title && <h2 className="text-xl font-bold text-[#0B2447]">{title}</h2>}
        {items.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label="Roteiro anterior"
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label="Próximo roteiro"
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition-all"
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
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {items.map(({ roteiro, initialFavorito, avaliacaoResumo }) => (
            <div key={roteiro.id} className="w-[260px] sm:w-[280px] shrink-0 snap-start">
              <RoteiroCard
                roteiro={roteiro}
                query={query}
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
