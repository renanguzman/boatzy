'use client';

import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';

/** Bloco de um filtro no painel lateral: título com ícone + conteúdo. */
export function FiltroSecao({ titulo, icone: Icone, children, acao }: {
  titulo: string;
  icone: React.ElementType;
  children: React.ReactNode;
  /** Ação à direita do título (ex.: "Limpar" daquele filtro). */
  acao?: { label: string; onClick: () => void } | null;
}) {
  return (
    <section className="px-5 py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Icone className="h-3.5 w-3.5 text-slate-400" />
          {titulo}
        </h3>
        {acao && (
          <button type="button" onClick={acao.onClick}
            className="text-[11px] font-semibold text-slate-400 hover:text-[#0B3D91]">
            {acao.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Chip de opção (seleção única ou múltipla). */
export function ChipFiltro({ ativo, onClick, children }: {
  ativo: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors
        ${ativo
          ? 'border-[#0B2447] bg-[#0B2447] text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  );
}

/** Linha de checkbox (lista de comodidades etc.). */
export function CheckFiltro({ marcado, onClick, children }: {
  marcado: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <span className={`h-[18px] w-[18px] shrink-0 rounded-[5px] border flex items-center justify-center transition-colors
        ${marcado ? 'bg-[#0B2447] border-[#0B2447]' : 'border-slate-300 bg-white'}`}>
        {marcado && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
      <span className="leading-tight">{children}</span>
    </button>
  );
}

/** Contador −/+ (ex.: tamanho do grupo). 0 = "Qualquer". */
export function ContadorFiltro({ valor, onChange, singular, plural, max = 99 }: {
  valor: number; onChange: (n: number) => void; singular: string; plural: string; max?: number;
}) {
  const btn = `h-9 w-9 shrink-0 rounded-full border flex items-center justify-center transition-colors
    disabled:border-slate-200 disabled:text-slate-300 disabled:cursor-default`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className={`text-sm ${valor > 0 ? 'font-medium text-slate-800' : 'text-slate-400'}`} aria-live="polite">
        {valor > 0 ? `${valor} ${valor === 1 ? singular : plural}` : 'Qualquer'}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, valor - 1))} disabled={valor === 0}
          aria-label={`Remover ${singular}`}
          className={`${btn} border-slate-300 text-slate-600 hover:border-[#0B2447] hover:text-[#0B2447]`}>
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onChange(Math.min(max, valor + 1))} disabled={valor >= max}
          aria-label={`Adicionar ${singular}`}
          className={`${btn} border-slate-300 text-slate-600 hover:border-[#0B2447] hover:text-[#0B2447]`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Contêiner com aparência de campo, para os seletores com dropdown (destino, data…). */
export function CampoFiltro({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
      {children}
    </div>
  );
}

const inputCls = `w-full rounded-xl border border-slate-200 bg-white py-2 pr-2.5 text-sm text-slate-800
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition
  [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

/**
 * Faixa mínimo–máximo. Aplica ao sair do campo, com Enter ou no botão
 * "Aplicar" (que aparece quando há alteração). Faixa invertida é normalizada
 * trocando os extremos. Para ressincronizar com a URL, o pai troca a `key`.
 */
export function FaixaNumerica({
  min, max, onAplicar, prefixo, sufixo, step = 1, rotulo, placeholderMin = 'Mínimo', placeholderMax = 'Máximo',
}: {
  min: string;
  max: string;
  onAplicar: (min: string, max: string) => void;
  prefixo?: string;
  sufixo?: string;
  step?: number;
  /** Nome da faixa para leitores de tela ("Preço", "Duração"…). */
  rotulo: string;
  placeholderMin?: string;
  placeholderMax?: string;
}) {
  const [dMin, setDMin] = useState(min);
  const [dMax, setDMax] = useState(max);
  const alterado = dMin !== min || dMax !== max;

  function aplicar() {
    if (!alterado) return;
    let a = dMin.trim();
    let b = dMax.trim();
    if (a && b && parseFloat(a) > parseFloat(b)) [a, b] = [b, a];
    setDMin(a);
    setDMax(b);
    onAplicar(a, b);
  }

  const afixo = prefixo ?? sufixo;
  const pad = afixo ? (afixo.length > 1 ? 'pl-9' : 'pl-7') : 'pl-3';

  function campo(valor: string, set: (v: string) => void, placeholder: string, sub: string) {
    return (
      <label className="relative flex-1 min-w-0">
        <span className="sr-only">{rotulo} {sub}</span>
        {afixo && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            {afixo}
          </span>
        )}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={valor}
          placeholder={placeholder}
          onChange={(e) => set(e.target.value)}
          onBlur={aplicar}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } }}
          className={`${inputCls} ${pad}`}
        />
      </label>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {campo(dMin, setDMin, placeholderMin, 'mínimo')}
        <span className="text-xs text-slate-400 shrink-0">até</span>
        {campo(dMax, setDMax, placeholderMax, 'máximo')}
      </div>
      {alterado && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={aplicar}
          className="mt-2 w-full rounded-lg bg-[#0B2447] hover:bg-[#0B3D91] py-2 text-xs font-semibold text-white transition-colors">
          Aplicar
        </button>
      )}
    </div>
  );
}
