'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Camera, ChevronLeft, ChevronRight, Expand, MapPin } from 'lucide-react';
import FotosLightbox, { type FotoLightbox } from '@/components/ui/FotosLightbox';

/**
 * Fotos do roteiro na confirmação da reserva: capa com nome/cidade sobrepostos e
 * um carrossel com as demais fotos (arrastar no celular, setas no computador).
 * Clicar na capa ou numa miniatura abre a foto em tela cheia (`FotosLightbox`).
 */
export default function GaleriaReserva({
  fotos, nome, localidade,
}: {
  /** Já ordenadas: a principal primeiro. */
  fotos: FotoLightbox[];
  nome: string;
  localidade: string | null;
}) {
  const t = useTranslations('GaleriaReserva');
  const tEmb = useTranslations('Embarcacao');
  const [aberta, setAberta] = useState<number | null>(null);
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);
  const demais = fotos.slice(1);

  const atualizarSetas = useCallback(() => {
    const el = trilhoRef.current;
    if (!el) return;
    setPodeVoltar(el.scrollLeft > 4);
    setPodeAvancar(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    atualizarSetas();
    const el = trilhoRef.current;
    if (!el) return;
    el.addEventListener('scroll', atualizarSetas, { passive: true });
    window.addEventListener('resize', atualizarSetas);
    return () => {
      el.removeEventListener('scroll', atualizarSetas);
      window.removeEventListener('resize', atualizarSetas);
    };
  }, [atualizarSetas]);

  function rolar(direcao: 1 | -1) {
    const el = trilhoRef.current;
    if (el) el.scrollBy({ left: direcao * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  const capa = fotos[0];

  return (
    <>
      {/* Capa */}
      <div className="relative h-52 sm:h-64 bg-slate-100">
        {capa ? (
          <button
            type="button"
            onClick={() => setAberta(0)}
            aria-label={t('verCapa', { nome })}
            className="group absolute inset-0 block cursor-zoom-in"
          >
            <Image
              src={capa.url_imagem}
              alt={capa.titulo ?? nome}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </button>
        ) : (
          <div className="h-full flex items-center justify-center"><MapPin className="h-10 w-10 text-slate-300" /></div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-marinho/85 via-marinho/20 to-transparent" />
        {capa && (
          <span className="pointer-events-none absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white">
            <Camera className="h-3.5 w-3.5" />
            {tEmb('fotos.contagem', { count: fotos.length })}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            <MapPin className="h-3 w-3" /> {t('roteiro')}
          </span>
          <h2 className="mt-2 text-xl sm:text-2xl font-bold text-white leading-tight">{nome}</h2>
          {localidade && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-200">
              <MapPin className="h-4 w-4 shrink-0" />
              {localidade}
            </div>
          )}
        </div>
      </div>

      {/* Carrossel das demais fotos */}
      {demais.length > 0 && (
        <div className="relative px-5 pt-4">
          <div
            ref={trilhoRef}
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-px-0"
          >
            {demais.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAberta(i + 1)}
                aria-label={t('verFoto', { n: i + 2, total: fotos.length })}
                className="group relative shrink-0 snap-start w-[30%] sm:w-[23%] aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marinho"
              >
                <Image
                  src={f.url_imagem}
                  alt={f.titulo ?? t('altFoto', { nome, n: i + 2 })}
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-marinho/0 transition-colors group-hover:bg-marinho/35">
                  <Expand className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </button>
            ))}
          </div>

          {/* Setas (computador) — somem quando não há mais para onde rolar */}
          <button
            type="button"
            onClick={() => rolar(-1)}
            aria-label={t('anteriores')}
            className={`hidden sm:flex absolute left-2 top-1/2 mt-2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/95 text-marinho shadow-md ring-1 ring-slate-200 transition-opacity hover:bg-white ${podeVoltar ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => rolar(1)}
            aria-label={t('proximas')}
            className={`hidden sm:flex absolute right-2 top-1/2 mt-2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/95 text-marinho shadow-md ring-1 ring-slate-200 transition-opacity hover:bg-white ${podeAvancar ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {aberta != null && (
        <FotosLightbox images={fotos} nome={nome} indice={aberta} onMudar={setAberta} onFechar={() => setAberta(null)} />
      )}
    </>
  );
}
