'use client';

import { useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Camera, X } from 'lucide-react';

export type FotoLightbox = { id: string; url_imagem: string; titulo: string | null };

/**
 * Visualizador de fotos em tela cheia (fundo escuro, contador, setas, ← → e Esc,
 * tira de miniaturas). Controlado: quem usa guarda o índice aberto (`null` =
 * fechado). Usado na galeria do detalhe do roteiro e na confirmação da reserva.
 */
export default function FotosLightbox({
  images, nome, indice, onMudar, onFechar,
}: {
  images: FotoLightbox[];
  nome: string;
  indice: number;
  onMudar: (i: number) => void;
  onFechar: () => void;
}) {
  const total = images.length;
  const anterior = useCallback(() => onMudar((indice - 1 + total) % total), [indice, total, onMudar]);
  const proxima = useCallback(() => onMudar((indice + 1) % total), [indice, total, onMudar]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === 'ArrowRight') proxima();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [anterior, proxima, onFechar]);

  if (total === 0) return null;

  return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-black/97 backdrop-blur-sm"
        onClick={() => onFechar()}
      >
        <div
          className="flex flex-col h-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#0B3D91] to-[#0B2447] flex items-center justify-center shrink-0">
                <Camera className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight line-clamp-1">
                  {nome}
                </p>
                <p className="text-white/50 text-xs">
                  {indice + 1} de {total} foto{total !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => onFechar()}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Fechar galeria"
            >
              <X className="h-4.5 w-4.5 text-white" />
            </button>
          </div>

          {/* Main image area */}
          <div className="flex-1 relative flex items-center justify-center px-4 md:px-16 min-h-0 py-4">
            <div className="relative w-full h-full max-w-5xl mx-auto">
              <Image
                key={images[indice].id}
                src={images[indice].url_imagem}
                alt={images[indice].titulo ?? `Foto ${indice + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 1280px) 100vw, 1280px"
              />
            </div>

            {/* Título da foto */}
            {images[indice].titulo && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[calc(100%-2rem)] md:max-w-2xl bg-black/65 text-white text-sm md:text-base font-medium text-center px-5 py-2.5 rounded-2xl backdrop-blur-sm pointer-events-none">
                {images[indice].titulo}
              </div>
            )}

            {/* Navigation arrows */}
            {total > 1 && (
              <>
                <button
                  onClick={anterior}
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={proxima}
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {total > 1 && (
            <div className="shrink-0 border-t border-white/10 px-4 py-3">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide justify-start md:justify-center">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => onMudar(i)}
                    title={img.titulo ?? undefined}
                    aria-label={img.titulo ?? `Foto ${i + 1}`}
                    className={`relative h-14 w-20 rounded-lg overflow-hidden shrink-0 transition-all duration-150 ${
                      i === indice
                        ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-black opacity-100 scale-105'
                        : 'opacity-45 hover:opacity-75'
                    }`}
                  >
                    <Image
                      src={img.url_imagem}
                      alt={img.titulo ?? `Miniatura ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
