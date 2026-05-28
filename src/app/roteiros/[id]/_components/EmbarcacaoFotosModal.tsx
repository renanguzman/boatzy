'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
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
  ExternalLink,
} from 'lucide-react';

type Imagem = { id: string; url_imagem: string; titulo: string | null; principal: boolean };

type Props = {
  embarcacao: {
    nome: string;
    capacidade: number | null;
    comprimento: number | null;
    cabines: number | null;
    tripulacao: number | null;
    modalidade_capitao: string;
    embarcacao_tipo: { nome: string } | null;
    embarcacao_imagens: Imagem[];
  };
};

const MODALIDADE: Record<string, string> = {
  com_capitao: 'Com Capitão',
  sem_capitao: 'Sem Capitão',
  opcional: 'Capitão Opcional',
};

export default function EmbarcacaoFotosModal({ embarcacao }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  // Sort: principal first
  const imagens = [...embarcacao.embarcacao_imagens].sort((a, b) =>
    a.principal === b.principal ? 0 : a.principal ? -1 : 1,
  );
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
    embarcacao.capacidade && { icon: Users, label: `${embarcacao.capacidade} pessoas` },
    embarcacao.comprimento && { icon: Ruler, label: `${embarcacao.comprimento} m` },
    embarcacao.cabines && { icon: Bed, label: `${embarcacao.cabines} ${embarcacao.cabines === 1 ? 'cabine' : 'cabines'}` },
    embarcacao.tripulacao && { icon: Shield, label: `${embarcacao.tripulacao} tripulação` },
    { icon: Anchor, label: MODALIDADE[embarcacao.modalidade_capitao] ?? embarcacao.modalidade_capitao },
  ].filter(Boolean) as { icon: React.ElementType; label: string }[];

  return (
    <>
      {/* Trigger — boat name as a styled link */}
      <button
        type="button"
        onClick={() => { setOpen(true); setCurrent(0); }}
        className="group flex items-center gap-1.5 text-left hover:text-[#0B3D91] transition-colors"
      >
        <span className="font-semibold text-slate-800 group-hover:text-[#0B3D91] transition-colors underline decoration-dotted underline-offset-2 decoration-slate-400 group-hover:decoration-[#0B3D91]">
          {embarcacao.nome}
        </span>
        {total > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 group-hover:text-[#0B3D91] transition-colors">
            <Camera className="h-3 w-3" />
            {total}
          </span>
        )}
        <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0B3D91] transition-colors opacity-0 group-hover:opacity-100" />
      </button>

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
            <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-[#0B2447] to-[#0B3D91]">
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Anchor className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white truncate">{embarcacao.nome}</h2>
                <p className="text-xs text-white/60">
                  {embarcacao.embarcacao_tipo?.nome ?? 'Embarcação'}
                  {total > 0 && ` · ${total} foto${total !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* ── Photo area ── */}
            {total === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 py-20 gap-4">
                <Anchor className="h-12 w-12 text-slate-600" />
                <p className="text-sm text-slate-500">Nenhuma foto disponível</p>
              </div>
            ) : (
              <div className="relative bg-slate-900 flex items-center justify-center" style={{ minHeight: '340px', maxHeight: '54vh' }}>
                {/* Main photo */}
                <div className="relative w-full h-full" style={{ aspectRatio: '16/9', maxHeight: '54vh' }}>
                  <Image
                    key={imagens[current].id}
                    src={imagens[current].url_imagem}
                    alt={imagens[current].titulo ?? `Foto ${current + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 896px"
                  />
                </div>

                {/* Caption */}
                {imagens[current].titulo && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-4 py-1.5 rounded-full backdrop-blur-sm">
                    {imagens[current].titulo}
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
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-all hover:scale-105 backdrop-blur-sm"
                      aria-label="Próxima foto"
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
                    className={`relative h-14 w-20 rounded-lg overflow-hidden shrink-0 transition-all duration-150 ${
                      i === current
                        ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950 opacity-100 scale-105'
                        : 'opacity-50 hover:opacity-80'
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
            )}

            {/* ── Specs footer ── */}
            {specs.length > 0 && (
              <div className="flex items-center justify-center gap-6 flex-wrap px-6 py-4 bg-slate-50 border-t border-slate-100">
                {specs.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Icon className="h-4 w-4 text-[#0B3D91] shrink-0" />
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
