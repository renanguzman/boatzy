'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { formatarPreco } from '@/lib/precos-roteiro';

const PRESETS = [
  { rotulo: '1 por semana', passeios: 4 },
  { rotulo: 'Todo fim de semana', passeios: 8 },
  { rotulo: 'Temporada cheia', passeios: 16 },
];

const PRECO_MIN = 500;
const PRECO_MAX = 50000;

/** Meses de verão em que a procura é maior (dezembro a março). */
const MESES_TEMPORADA = 4;

/**
 * Simulação do que o dono recebe: preço por passeio × passeios no mês. O gestor recebe 100% do
 * preço que define (a taxa de serviço é paga pelo cliente, somada ao preço — PRD §6.6, D7).
 */
export default function SimuladorGanhos() {
  const [preco, setPreco] = useState(1500);
  const [passeios, setPasseios] = useState(4);

  const porMes = preco * passeios;

  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_24px_60px_-24px_rgba(14,47,79,0.28)] ring-1 ring-slate-100 sm:p-8">
      <div className="space-y-7">
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <label htmlFor="sim-preco" className="text-sm font-semibold text-grafite">Seu preço por passeio</label>
            <span className="text-lg font-bold text-marinho tabular-nums">{formatarPreco(preco)}</span>
          </div>
          <input
            id="sim-preco"
            type="range"
            min={PRECO_MIN}
            max={PRECO_MAX}
            step={100}
            value={preco}
            onChange={(e) => setPreco(Number(e.target.value))}
            aria-valuetext={formatarPreco(preco)}
            className="h-2 w-full cursor-pointer accent-turquesa"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>{formatarPreco(PRECO_MIN)}</span>
            <span>{formatarPreco(PRECO_MAX)}</span>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <label htmlFor="sim-passeios" className="text-sm font-semibold text-grafite">Passeios por mês</label>
            <span className="text-lg font-bold text-marinho tabular-nums">{passeios}</span>
          </div>
          <input
            id="sim-passeios"
            type="range"
            min={1}
            max={20}
            step={1}
            value={passeios}
            onChange={(e) => setPasseios(Number(e.target.value))}
            aria-valuetext={`${passeios} ${passeios === 1 ? 'passeio' : 'passeios'} por mês`}
            className="h-2 w-full cursor-pointer accent-turquesa"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.rotulo}
                type="button"
                onClick={() => setPasseios(p.passeios)}
                aria-pressed={passeios === p.passeios}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  passeios === p.passeios
                    ? 'bg-marinho text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-turquesa/15 hover:text-marinho'
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className="relative mt-7 overflow-hidden rounded-2xl bg-marinho p-6 text-white" aria-live="polite">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-turquesa/30 blur-3xl" />
        <p className="relative text-xs font-semibold uppercase tracking-widest text-turquesa">Você recebe por mês</p>
        <p className="relative mt-1 text-4xl font-bold tabular-nums sm:text-5xl">{formatarPreco(porMes)}</p>
        <div className="relative mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
          <div>
            <p className="text-xs text-slate-300">Temporada de verão ({MESES_TEMPORADA} meses)</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{formatarPreco(porMes * MESES_TEMPORADA)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-300">Taxa do Boatzy para você</p>
            <p className="mt-0.5 text-lg font-bold text-turquesa">R$ 0</p>
          </div>
        </div>
      </div>

      <p className="mt-4 flex gap-2 text-xs leading-relaxed text-slate-500">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-turquesa-escuro" />
        Simulação. O resultado real depende do seu preço, da época do ano e da procura pelos seus roteiros.
      </p>
    </div>
  );
}
