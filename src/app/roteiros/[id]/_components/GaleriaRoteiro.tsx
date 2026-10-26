'use client';

import { useState, useCallback, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Camera, Anchor } from 'lucide-react';
import FotosLightbox from '@/components/ui/FotosLightbox';

type Imagem = { id: string; url_imagem: string; titulo: string | null; principal: boolean };

type Props = {
  images: Imagem[];
  nome: string;
  voltarHref?: string;
  /** Ações sobre a foto principal, no canto superior direito — só no celular (ex.: favoritar/compartilhar). */
  acoes?: ReactNode;
};

/** Deslocamento horizontal mínimo (px) para o toque contar como "deslizar" e não como toque. */
const LIMIAR_SWIPE = 40;

export default function GaleriaRoteiro({ images, nome, voltarHref = '/buscar', acoes }: Props) {
  const t = useTranslations('Galeria');
  const tComum = useTranslations('Comum');
  const total = images.length;
  const [current, setCurrent] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIdx, setModalIdx] = useState(0);
  // Celular: deslizar troca a foto; um toque simples abre a galeria em tela cheia.
  const toqueInicio = useRef<{ x: number; y: number } | null>(null);
  const deslizou = useRef(false);

  const prevCarousel = useCallback(
    () => setCurrent((c) => (c - 1 + total) % total),
    [total],
  );
  const nextCarousel = useCallback(
    () => setCurrent((c) => (c + 1) % total),
    [total],
  );
  function openModal(idx: number) {
    setModalIdx(idx);
    setModalOpen(true);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    toqueInicio.current = { x: t.clientX, y: t.clientY };
    deslizou.current = false;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const inicio = toqueInicio.current;
    toqueInicio.current = null;
    if (!inicio || total < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicio.x;
    // Só gesto predominantemente horizontal: rolar a página não troca a foto.
    if (Math.abs(dx) < LIMIAR_SWIPE || Math.abs(dx) < Math.abs(t.clientY - inicio.y)) return;
    deslizou.current = true;
    if (dx < 0) nextCarousel();
    else prevCarousel();
  }

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
              } ${mainImg ? 'cursor-zoom-in' : ''}`}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onClick={() => {
                // O clique que segue um deslize não abre a galeria.
                if (deslizou.current) { deslizou.current = false; return; }
                if (mainImg) openModal(current);
              }}
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
                  <div className={`absolute inset-0 bg-gradient-to-t ${mainImg.titulo ? 'from-black/60 via-black/5' : 'from-black/30 via-transparent'} to-transparent pointer-events-none`} />

                  {/* Título da foto — acima dos pontos/"Ver todas" no mobile */}
                  {mainImg.titulo && (
                    <p className="absolute left-4 right-4 lg:right-auto lg:max-w-[70%] bottom-12 lg:bottom-5 text-white text-sm md:text-base font-semibold drop-shadow-md line-clamp-2 pointer-events-none">
                      {mainImg.titulo}
                    </p>
                  )}

                  {/* Contador (celular): posição atual e total; tocar abre a galeria */}
                  {total > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openModal(current); }}
                      aria-label={t('verTodasN', { count: total })}
                      className="absolute bottom-4 right-4 z-10 lg:hidden inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white tabular-nums"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {current + 1}/{total}
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <Anchor className="h-12 w-12 text-slate-200" />
                  <p className="text-sm text-slate-300">{t('semFotos')}</p>
                </div>
              )}

              {/* Back button */}
              <Link
                href={voltarHref}
                onClick={(e) => e.stopPropagation()}
                aria-label={tComum('voltar')}
                className="absolute top-4 left-4 z-10 h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              >
                <ChevronLeft className="h-5 w-5 text-slate-700" />
              </Link>

              {/* Favoritar/compartilhar sobre a foto (celular; no desktop ficam na coluna de reserva) */}
              {acoes && (
                <div className="absolute top-4 right-4 z-10 lg:hidden" onClick={(e) => e.stopPropagation()}>
                  {acoes}
                </div>
              )}

              {/* Carousel arrows — só no desktop; no celular a troca é deslizando */}
              {total > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevCarousel(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 hover:bg-black/65 text-white hidden lg:flex items-center justify-center transition-all backdrop-blur-sm hover:scale-105 active:scale-95"
                    aria-label={t('anterior')}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextCarousel(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/40 hover:bg-black/65 text-white hidden lg:flex items-center justify-center transition-all backdrop-blur-sm hover:scale-105 active:scale-95"
                    aria-label={t('proxima')}
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
                      alt={side1.titulo ?? t('foto', { n: (current + 1) % total + 1 })}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="33vw"
                    />
                    {side1.titulo && <LegendaLateral titulo={side1.titulo} />}
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
                      alt={side2.titulo ?? t('foto', { n: (current + 2) % total + 1 })}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="33vw"
                    />
                    {side2.titulo && <LegendaLateral titulo={side2.titulo} comBotao />}

                    {/* "Ver todas" — always visible on last side when there are photos */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(current);
                      }}
                      className="absolute bottom-3 right-3 z-10 bg-white/90 backdrop-blur-sm text-grafite text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-white transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {t('verTodas', { count: total })}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* "Ver todas" no desktop quando não há fotos laterais (no celular, o contador faz esse papel) */}
            {mainImg && !hasSides && (
              <button
                onClick={() => openModal(current)}
                className="absolute bottom-4 right-4 z-10 bg-white/90 backdrop-blur-sm text-grafite text-xs font-semibold px-4 py-2 rounded-lg hidden lg:flex items-center gap-1.5 hover:bg-white transition-all shadow-md"
              >
                <Camera className="h-3.5 w-3.5" />
                {t('verTodas', { count: total })}
              </button>
            )}
          </div>
        </div>
      </section>

      {modalOpen && (
        <FotosLightbox images={images} nome={nome} indice={modalIdx} onMudar={setModalIdx} onFechar={() => setModalOpen(false)} />
      )}
    </>
  );
}

/** Título sobre as fotos laterais (desktop). `comBotao` reserva espaço para o "Ver todas". */
function LegendaLateral({ titulo, comBotao = false }: { titulo: string; comBotao?: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pt-8 pb-3 pointer-events-none">
      <p className={`text-white text-xs font-semibold drop-shadow truncate ${comBotao ? 'pr-32' : ''}`}>
        {titulo}
      </p>
    </div>
  );
}
