'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Camera, X, Anchor } from 'lucide-react';

type Imagem = { id: string; url_imagem: string; titulo: string | null; principal: boolean };

type Props = {
  images: Imagem[];
  nome: string;
  voltarHref?: string;
};

export default function GaleriaRoteiro({ images, nome, voltarHref = '/buscar' }: Props) {
  const total = images.length;
  const [current, setCurrent] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIdx, setModalIdx] = useState(0);

  const prevCarousel = useCallback(
    () => setCurrent((c) => (c - 1 + total) % total),
    [total],
  );
  const nextCarousel = useCallback(
    () => setCurrent((c) => (c + 1) % total),
    [total],
  );
  const prevModal = useCallback(
    () => setModalIdx((c) => (c - 1 + total) % total),
    [total],
  );
  const nextModal = useCallback(
    () => setModalIdx((c) => (c + 1) % total),
    [total],
  );

  function openModal(idx: number) {
    setModalIdx(idx);
    setModalOpen(true);
  }

  // Keyboard navigation
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
      if (e.key === 'ArrowLeft') prevModal();
      if (e.key === 'ArrowRight') nextModal();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [modalOpen, prevModal, nextModal]);

  const mainImg = total > 0 ? images[current] : null;
  const side1 = total > 1 ? images[(current + 1) % total] : null;
  const side2 = total > 2 ? images[(current + 2) % total] : null;
  const hasSides = side1 !== null;

  return (
    <>
      {/* ── Gallery grid ── */}
      <section className="relative" id="roteiro-gallery">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div
            className={`relative grid gap-3 h-[300px] md:h-[450px] ${
              mainImg && hasSides ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'
            }`}
          >
            {/* Main image */}
            <div
              className={`relative rounded-2xl overflow-hidden bg-slate-100 ${
                hasSides ? 'lg:col-span-2' : ''
              }`}
            >
              {mainImg ? (
                <>
                  <Image
                    key={mainImg.id}
                    src={mainImg.url_imagem}
                    alt={mainImg.titulo ?? nome}
                    fill
                    className="object-cover transition-opacity duration-300"
                    priority
                    sizes="(max-width: 1024px) 100vw, 66vw"
                  />

                  {/* Gradient overlay (bottom) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

                  {/* Dot indicators (mobile only) */}
                  {total > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 lg:hidden pointer-events-none">
                      {images.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-200 ${
                            i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <Anchor className="h-12 w-12 text-slate-200" />
                  <p className="text-sm text-slate-300">Sem fotos disponíveis</p>
                </div>
              )}

              {/* Back button */}
              <Link
                href={voltarHref}
                className="absolute top-4 left-4 z-10 h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              >
                <ChevronLeft className="h-5 w-5 text-slate-700" />
              </Link>

              {/* Carousel arrows */}
              {total > 1 && (
                <>
                  <button
                    onClick={prevCarousel}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all backdrop-blur-sm hover:scale-105 active:scale-95"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextCarousel}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all backdrop-blur-sm hover:scale-105 active:scale-95"
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Side images (desktop) */}
            {hasSides && (
              <div className="hidden lg:grid grid-rows-2 gap-3">
                {/* Side 1 */}
                {side1 && (
                  <div
                    className="relative rounded-2xl overflow-hidden bg-slate-100 cursor-pointer group"
                    onClick={() => setCurrent((current + 1) % total)}
                  >
                    <Image
                      src={side1.url_imagem}
                      alt={side1.titulo ?? `Foto ${(current + 1) % total + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="33vw"
                    />
                  </div>
                )}

                {/* Side 2 */}
                {side2 && (
                  <div
                    className="relative rounded-2xl overflow-hidden bg-slate-100 cursor-pointer group"
                    onClick={() => setCurrent((current + 2) % total)}
                  >
                    <Image
                      src={side2.url_imagem}
                      alt={side2.titulo ?? `Foto ${(current + 2) % total + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="33vw"
                    />

                    {/* "Ver todas" — always visible on last side when there are photos */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(current);
                      }}
                      className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-white transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Ver todas ({total})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* "Ver todas" for mobile / when no side images */}
            {mainImg && (total <= 2 || !hasSides) && total > 0 && (
              <button
                onClick={() => openModal(current)}
                className="absolute bottom-4 right-4 z-10 bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-white transition-all shadow-md lg:hidden"
              >
                <Camera className="h-3.5 w-3.5" />
                Ver todas ({total})
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Full-screen modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[300] flex flex-col bg-black/97 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
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
                    {modalIdx + 1} de {total} foto{total !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
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
                  key={images[modalIdx].id}
                  src={images[modalIdx].url_imagem}
                  alt={images[modalIdx].titulo ?? `Foto ${modalIdx + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1280px) 100vw, 1280px"
                />
              </div>

              {/* Caption */}
              {images[modalIdx].titulo && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-5 py-2 rounded-full backdrop-blur-sm pointer-events-none">
                  {images[modalIdx].titulo}
                </div>
              )}

              {/* Navigation arrows */}
              {total > 1 && (
                <>
                  <button
                    onClick={prevModal}
                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={nextModal}
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
                      onClick={() => setModalIdx(i)}
                      className={`relative h-14 w-20 rounded-lg overflow-hidden shrink-0 transition-all duration-150 ${
                        i === modalIdx
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
      )}
    </>
  );
}
