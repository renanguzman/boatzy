'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type EtapaDef = {
  id: string;
  /** Rótulo curto (indicador, rodapé, "Próximo: …"). */
  label: string;
  /** Linha de apoio sob o rótulo no indicador (desktop). */
  desc: string;
};

type Props = {
  etapas: EtapaDef[];
  atual: number;
  visitadas: boolean[];
  onIr: (i: number) => void;
};

/**
 * Indicador de etapas do cadastro. Desktop (≥ md): trilha horizontal com
 * círculos numerados ligados por linhas — concluída (✓), atual (anel) e
 * pendente; cada etapa é clicável. Celular: etapa atual + barra segmentada e
 * um menu "Ver etapas" com a lista completa.
 */
export default function IndicadorEtapas({ etapas, atual, visitadas, onIr }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuAberto]);

  const concluida = (i: number) => visitadas[i] && i !== atual;

  return (
    <nav aria-label="Etapas do cadastro"
      className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 md:px-6 md:py-5">

      {/* Desktop */}
      <ol className="hidden md:flex items-start">
        {etapas.map((e, i) => {
          const atualI = i === atual;
          const feita = concluida(i);
          return (
            <li key={e.id} className="flex items-start flex-1 last:flex-none min-w-0">
              <button type="button" onClick={() => onIr(i)}
                aria-current={atualI ? 'step' : undefined}
                className="group flex flex-col items-center gap-2 w-24 lg:w-28 shrink-0 text-center">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition
                  ${feita ? 'bg-[#0B2447] text-white' : atualI
                    ? 'bg-white text-[#0B2447] border-2 border-[#0B2447] ring-4 ring-[#0B2447]/10'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                  {feita ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={`text-[13px] leading-tight ${atualI ? 'font-bold text-[#0B2447]' : feita ? 'font-semibold text-[#0B2447]' : 'font-semibold text-slate-400'}`}>
                  {e.label}
                </span>
                <span className="text-[11px] leading-tight text-slate-400 hidden lg:block">{e.desc}</span>
              </button>
              {i < etapas.length - 1 && (
                <span aria-hidden className={`flex-1 h-0.5 mt-4 rounded-full ${i < atual ? 'bg-[#0B2447]' : 'bg-slate-200'}`} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Celular */}
      <div className="md:hidden relative" ref={menuRef}>
        <button type="button" onClick={() => setMenuAberto(v => !v)} aria-expanded={menuAberto}
          className="w-full flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 shrink-0 rounded-full border-2 border-[#0B2447] flex items-center justify-center text-xs font-bold text-[#0B2447]">
              {atual + 1}
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[11px] text-slate-500">Etapa {atual + 1} de {etapas.length}</span>
              <span className="block text-sm font-bold text-[#0B2447] truncate">{etapas[atual].label}</span>
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[#0B3D91] shrink-0">
            Ver etapas <ChevronDown className={`w-4 h-4 transition-transform ${menuAberto ? 'rotate-180' : ''}`} />
          </span>
        </button>

        <div className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(0, 1fr))` }} aria-hidden>
          {etapas.map((e, i) => (
            <span key={e.id} className={`h-1 rounded-full ${i <= atual ? 'bg-[#0B2447]' : 'bg-slate-200'}`} />
          ))}
        </div>

        {menuAberto && (
          <ul className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl border border-slate-200 bg-white shadow-xl py-1.5">
            {etapas.map((e, i) => (
              <li key={e.id}>
                <button type="button" onClick={() => { onIr(i); setMenuAberto(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${i === atual ? 'bg-slate-50' : ''}`}>
                  <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold
                    ${concluida(i) ? 'bg-[#0B2447] text-white' : i === atual ? 'border-2 border-[#0B2447] text-[#0B2447]' : 'bg-slate-100 text-slate-400'}`}>
                    {concluida(i) ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm ${i === atual ? 'font-bold text-[#0B2447]' : 'font-medium text-slate-700'}`}>{e.label}</span>
                    <span className="block text-xs text-slate-400 truncate">{e.desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
