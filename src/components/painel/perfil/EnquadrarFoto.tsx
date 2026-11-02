'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Minus, Plus, X } from 'lucide-react';
import {
  ZOOM_MAX, ZOOM_MIN, areaInicial, escalaDoQuadro, exportarFotoPerfil, lerImagem, limitarArea,
  type AreaEnquadrada,
} from '@/lib/imagem-perfil';

type Props = {
  arquivo: File;
  /** Recebe a foto já recortada e reduzida. */
  onConfirmar: (foto: { blob: Blob; extensao: 'webp' | 'jpg' }) => void;
  onCancelar: () => void;
};

/**
 * Enquadramento da foto do perfil (SPEC §99): o operador arrasta e aproxima para escolher o
 * que aparece no retrato 4:5 do site. Tudo no navegador (canvas), sem dependência nova.
 */
export default function EnquadrarFoto({ arquivo, onConfirmar, onCancelar }: Props) {
  const quadroRef = useRef<HTMLDivElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [quadro, setQuadro] = useState({ w: 0, h: 0 });
  /** Ajuste feito pelo gestor; enquanto não mexe, vale o enquadramento inicial. */
  const [ajuste, setAjuste] = useState<AreaEnquadrada | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arrasto = useRef<{ x: number; y: number } | null>(null);

  // Lê a imagem (com a orientação certa) e cria a URL de pré-visualização.
  useEffect(() => {
    let cancelado = false;
    let objeto: string | null = null;
    lerImagem(arquivo)
      .then((b) => {
        if (cancelado) { b.close(); return; }
        objeto = URL.createObjectURL(arquivo);
        setUrl(objeto);
        setBitmap(b);
      })
      .catch(() => { if (!cancelado) setErro('Não foi possível ler esta imagem. Tente outra foto.'); });
    return () => { cancelado = true; if (objeto) URL.revokeObjectURL(objeto); };
  }, [arquivo]);
  useEffect(() => () => bitmap?.close(), [bitmap]);

  // Mede o quadro (responsivo) e reposiciona quando ele muda de tamanho.
  useLayoutEffect(() => {
    const el = quadroRef.current;
    if (!el) return;
    const medir = () => setQuadro({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pronto = bitmap !== null && quadro.w > 0;
  // Sempre dentro da imagem, mesmo se o quadro mudar de tamanho (girar o celular).
  const area = bitmap && quadro.w > 0 ? limitarArea(ajuste ?? areaInicial(bitmap, quadro), bitmap, quadro) : null;

  // Esc cancela; a página por trás não rola.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !salvando && onCancelar();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', onKey); };
  }, [onCancelar, salvando]);

  const mover = useCallback((dx: number, dy: number) => {
    if (!bitmap || quadro.w === 0) return;
    setAjuste((anterior) => {
      const a = limitarArea(anterior ?? areaInicial(bitmap, quadro), bitmap, quadro);
      const escala = escalaDoQuadro(bitmap, quadro, a.zoom);
      return limitarArea({ ...a, cx: a.cx - dx / escala, cy: a.cy - dy / escala }, bitmap, quadro);
    });
  }, [bitmap, quadro]);

  function aplicarZoom(zoom: number) {
    if (!bitmap || quadro.w === 0) return;
    setAjuste((anterior) => limitarArea({ ...limitarArea(anterior ?? areaInicial(bitmap, quadro), bitmap, quadro), zoom }, bitmap, quadro));
  }

  async function confirmar() {
    if (!bitmap || !area || salvando) return;
    setSalvando(true);
    const foto = await exportarFotoPerfil(bitmap, quadro, area);
    setSalvando(false);
    if (!foto) { setErro('Não foi possível preparar a foto. Tente outra imagem.'); return; }
    onConfirmar(foto);
  }

  // Posição da imagem dentro do quadro (CSS).
  let estilo: React.CSSProperties | undefined;
  if (bitmap && area && quadro.w > 0) {
    const escala = escalaDoQuadro(bitmap, quadro, area.zoom);
    estilo = {
      width: bitmap.width * escala,
      height: bitmap.height * escala,
      left: quadro.w / 2 - area.cx * escala,
      top: quadro.h / 2 - area.cy * escala,
    };
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="enquadrar-titulo">
      <div className="absolute inset-0 bg-[#0B2447]/50 backdrop-blur-[2px]" onClick={() => !salvando && onCancelar()} />
      <div className="relative flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6">
          <div>
            <h2 id="enquadrar-titulo" className="text-base font-bold text-[#0B2447]">Ajuste a sua foto</h2>
            <p className="text-xs text-slate-500">Arraste para posicionar e use o zoom. É assim que ela aparece no site.</p>
          </div>
          <button type="button" onClick={onCancelar} disabled={salvando} aria-label="Fechar"
            className="-mr-1 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-[#0B2447] disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {erro ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{erro}</p>
          ) : (
            <>
              <div
                ref={quadroRef}
                tabIndex={0}
                role="group"
                aria-label="Quadro da foto. Use as setas para mover."
                onPointerDown={(e) => { arrasto.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerMove={(e) => {
                  if (!arrasto.current) return;
                  mover(e.clientX - arrasto.current.x, e.clientY - arrasto.current.y);
                  arrasto.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={() => { arrasto.current = null; }}
                onPointerCancel={() => { arrasto.current = null; }}
                onKeyDown={(e) => {
                  const passo = 12;
                  if (e.key === 'ArrowLeft') { e.preventDefault(); mover(passo, 0); }
                  else if (e.key === 'ArrowRight') { e.preventDefault(); mover(-passo, 0); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); mover(0, passo); }
                  else if (e.key === 'ArrowDown') { e.preventDefault(); mover(0, -passo); }
                }}
                className="relative mx-auto aspect-[4/5] w-[min(72vw,280px)] cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 active:cursor-grabbing"
              >
                {url && estilo && (
                  // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), fora do otimizador do Next
                  <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={estilo} />
                )}
                {!pronto && <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-slate-400" />}
              </div>

              <div className="mx-auto mt-5 flex w-[min(72vw,280px)] items-center gap-3">
                <button type="button" onClick={() => aplicarZoom((area?.zoom ?? 1) - 0.2)} aria-label="Afastar"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"><Minus className="h-4 w-4" /></button>
                <input
                  type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={area?.zoom ?? 1}
                  onChange={(e) => aplicarZoom(Number(e.target.value))}
                  aria-label="Zoom" className="h-2 flex-1 cursor-pointer accent-teal-600"
                />
                <button type="button" onClick={() => aplicarZoom((area?.zoom ?? 1) + 0.2)} aria-label="Aproximar"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onCancelar} disabled={salvando}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40 sm:py-2.5">
            Cancelar
          </button>
          <button type="button" onClick={() => void confirmar()} disabled={!pronto || salvando || !!erro}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0B3D91] disabled:opacity-40 sm:py-2.5">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Usar esta foto
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
