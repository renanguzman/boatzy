'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Anchor,
  Users,
  Ruler,
  Bed,
  Shield,
  Camera,
} from 'lucide-react';
import { ordenarImagens } from '@/lib/galeria';
import { useFormatos } from '@/i18n/formatos';
import { useCatalogo } from '@/i18n/CatalogoProvider';
import { useRotulos } from '@/i18n/rotulos';

type Imagem = { id: string; url_imagem: string; titulo: string | null; principal: boolean; ordem: number };

type Props = {
  /** URL da foto principal (exibida grande como gatilho da galeria). */
  capa: string | null;
  embarcacao: {
    nome: string;
    capacidade: number | null;
    comprimento: number | null;
    comprimento_unidade: string | null;
    quartos: number | null;
    tripulacao: number | null;
    modalidade_capitao: string;
    embarcacao_tipo: { nome: string } | null;
    embarcacao_imagens: Imagem[];
  };
};

export default function EmbarcacaoFotosModal({ capa, embarcacao }: Props) {
  const t = useTranslations('Embarcacao');
  const tGaleria = useTranslations('Galeria');
  const tComum = useTranslations('Comum');
  const f = useFormatos();
  const { traduzir } = useCatalogo();
  const rotulos = useRotulos();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  // Ordem da galeria definida pelo gestor
  const imagens = ordenarImagens(embarcacao.embarcacao_imagens);
  const total = imagens.length;

  const prev = useCallback(() => setCurrent((c) => (c - 1 + total) % total), [total]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % total), [total]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, prev, next]);

  const specs = [
    embarcacao.capacidade && { icon: Users, label: f.pessoas(embarcacao.capacidade) },
    embarcacao.comprimento && { icon: Ruler, label: f.comprimento(embarcacao.comprimento, embarcacao.comprimento_unidade) ?? '' },
    embarcacao.quartos && { icon: Bed, label: t('specs.quartos', { count: embarcacao.quartos }) },
    embarcacao.tripulacao && { icon: Shield, label: t('specs.tripulacao', { count: embarcacao.tripulacao }) },
    { icon: Anchor, label: rotulos.capitao(embarcacao.modalidade_capitao) },
  ].filter(Boolean) as { icon: React.ElementType; label: string }[];

  return (
    <>
      {/* Trigger — foto principal grande; o selo "N fotos" sobre ela abre a galeria */}
      {capa && total > 0 ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setCurrent(Math.max(0, imagens.findIndex((i) => i.url_imagem === capa))); }}
          aria-label={t('fotos.verFotos', { count: total, nome: embarcacao.nome })}
          className="group relative block aspect-[16/10] w-full sm:w-60 shrink-0 overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marinho"
        >
          <Image
            src={capa}
            alt={embarcacao.nome}
            fill
            sizes="(min-width: 640px) 240px, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-marinho shadow-sm transition-colors group-hover:bg-marinho group-hover:text-white">
            <Camera className="h-3.5 w-3.5" />
            {t('fotos.contagem', { count: total })}
          </span>
        </button>
      ) : (
        <div className="flex aspect-[16/10] w-full sm:w-60 shrink-0 items-center justify-center rounded-xl bg-marinho/10">
          <Anchor className="h-10 w-10 text-marinho/60" />
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-marinho-escuro to-marinho">
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Anchor className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white truncate">{embarcacao.nome}</h2>
                <p className="text-xs text-white/60">
                  {embarcacao.embarcacao_tipo ? traduzir('tipo', embarcacao.embarcacao_tipo.nome) : t('fotos.embarcacao')}
                  {total > 0 && ` · ${t('fotos.contagem', { count: total })}`}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
                aria-label={tComum('fechar')}
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* ── Photo area ── */}
            {total === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 py-20 gap-4">
                <Anchor className="h-12 w-12 text-slate-600" />
                <p className="text-sm text-slate-500">{t('fotos.nenhumaFoto')}</p>
              </div>
            ) : (
              <div className="relative bg-slate-900 flex items-center justify-center" style={{ minHeight: '340px', maxHeight: '54vh' }}>
                {/* Main photo */}
                <div className="relative w-full h-full" style={{ aspectRatio: '16/9', maxHeight: '54vh' }}>
                  <Image
                    key={imagens[current].id}
                    src={imagens[current].url_imagem}
                    alt={imagens[current].titulo ?? tGaleria('foto', { n: current + 1 })}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 896px"
                  />
                </div>

                {/* Caption */}
                {imagens[current].titulo && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pt-10 pb-4 pointer-events-none">
                    <p className="text-white text-sm md:text-base font-semibold drop-shadow line-clamp-2">
                      {imagens[current].titulo}
                    </p>
                  </div>
                )}

                {/* Counter */}
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-3 py-1 rounded-full backdrop-blur-sm">
                  {current + 1} / {total}
                </div>

                {/* Nav arrows */}
                {total > 1 && (
                  <>
                    <button
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all hover:scale-105 backdrop-blur-sm"
                      aria-label={tGaleria('anterior')}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all hover:scale-105 backdrop-blur-sm"
                      aria-label={tGaleria('proxima')}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Thumbnails ── */}
            {total > 1 && (
              <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-slate-950 scrollbar-hide">
                {imagens.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrent(i)}
                    title={img.titulo ?? undefined}
                    aria-label={img.titulo ?? tGaleria('foto', { n: i + 1 })}
                    className={`relative h-14 w-20 rounded-lg overflow-hidden shrink-0 transition-all duration-150 ${
                      i === current
                        ? 'ring-2 ring-turquesa ring-offset-1 ring-offset-slate-950 opacity-100 scale-105'
                        : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <Image
                      src={img.url_imagem}
                      alt={img.titulo ?? tGaleria('miniatura', { n: i + 1 })}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* ── Specs footer ── */}
            {specs.length > 0 && (
              <div className="flex items-center justify-center gap-6 flex-wrap px-6 py-4 bg-slate-50 border-t border-slate-100">
                {specs.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Icon className="h-4 w-4 text-marinho shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
