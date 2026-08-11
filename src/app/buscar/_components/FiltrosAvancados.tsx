'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { DURACAO_PRESETS } from '@/lib/duracao';
import { buildBuscarUrl, type BuscaSearchParams } from '../_lib/filtros';

type Props = {
  /** Params atuais da URL — vêm da página (Server Component), não de useSearchParams. */
  params: BuscaSearchParams;
  /** Quantos filtros avançados estão ativos (badge do botão). */
  ativos: number;
};

const inputCls = `w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
  focus:border-[#0B2447]/40 transition bg-white`;

/** Compara faixa do rascunho com um preset (strings vs números). */
function ehPreset(draftMin: string, draftMax: string, min: number | null, max: number | null) {
  const norm = (v: string) => (v === '' ? null : parseFloat(v));
  return norm(draftMin) === min && norm(draftMax) === max;
}

export default function FiltrosAvancados({ params, ativos }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [precoMin, setPrecoMin] = useState(params.preco_min ?? '');
  const [precoMax, setPrecoMax] = useState(params.preco_max ?? '');
  const [duracaoMin, setDuracaoMin] = useState(params.duracao_min ?? '');
  const [duracaoMax, setDuracaoMax] = useState(params.duracao_max ?? '');

  // Abrir sempre parte do que está na URL — inclusive depois de um chip ter
  // removido uma faixa (mesmo padrão do ValorVendaPicker da busca de Vendas).
  function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setPrecoMin(params.preco_min ?? '');
    setPrecoMax(params.preco_max ?? '');
    setDuracaoMin(params.duracao_min ?? '');
    setDuracaoMax(params.duracao_max ?? '');
    setAberto(true);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function aplicar() {
    // Faixa invertida (min > max) é normalizada trocando os extremos —
    // mesma tolerância do filtro de valor da busca de Vendas.
    let pMin = precoMin;
    let pMax = precoMax;
    if (pMin && pMax && parseFloat(pMin) > parseFloat(pMax)) [pMin, pMax] = [pMax, pMin];

    let dMin = duracaoMin;
    let dMax = duracaoMax;
    if (dMin && dMax && parseFloat(dMin) > parseFloat(dMax)) [dMin, dMax] = [dMax, dMin];

    router.push(
      buildBuscarUrl(params, {
        preco_min: pMin,
        preco_max: pMax,
        duracao_min: dMin,
        duracao_max: dMax,
        pagina: null, // mudou o filtro: volta para a primeira página
      }),
    );
    setAberto(false);
  }

  function limpar() {
    setPrecoMin('');
    setPrecoMax('');
    setDuracaoMin('');
    setDuracaoMax('');
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={alternar}
        className={`flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1.5 border transition-colors cursor-pointer ${
          aberto || ativos > 0
            ? 'border-[#0B2447] text-[#0B2447] bg-white'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
        aria-expanded={aberto}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filtros
        {ativos > 0 && (
          <span className="h-4 w-4 rounded-full bg-[#0B2447] text-white text-[10px] font-bold flex items-center justify-center">
            {ativos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-[22rem] max-w-[calc(100vw-2rem)] p-4">
          {/* Faixa de preço */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Faixa de preço
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                R$
              </span>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="50"
                placeholder="Mínimo"
                value={precoMin}
                onChange={(e) => setPrecoMin(e.target.value)}
              />
            </div>
            <span className="text-slate-400 text-sm shrink-0">até</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                R$
              </span>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="50"
                placeholder="Máximo"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
              />
            </div>
          </div>

          {/* Duração do passeio */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-5 mb-3">
            Duração do passeio
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DURACAO_PRESETS.map((preset) => {
              const ativo = ehPreset(duracaoMin, duracaoMax, preset.min, preset.max);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    // Reclicar no preset ativo desmarca a faixa.
                    setDuracaoMin(ativo || preset.min == null ? '' : String(preset.min));
                    setDuracaoMax(ativo || preset.max == null ? '' : String(preset.max));
                  }}
                  className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors cursor-pointer ${
                    ativo
                      ? 'border-[#0B2447] bg-[#0B2447] text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                h
              </span>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.5"
                placeholder="Mínimo"
                value={duracaoMin}
                onChange={(e) => setDuracaoMin(e.target.value)}
              />
            </div>
            <span className="text-slate-400 text-sm shrink-0">até</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                h
              </span>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.5"
                placeholder="Máximo"
                value={duracaoMax}
                onChange={(e) => setDuracaoMax(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Em horas — 1 dia equivale a 24 h.</p>

          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={limpar}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={aplicar}
              className="px-4 py-2 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
