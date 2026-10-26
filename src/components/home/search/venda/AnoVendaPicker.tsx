'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { anoVendaLabel } from './labels';

export type AnoVendaValue = { min: string; max: string };

// Re-export para os call sites que já importavam daqui.
export { anoVendaLabel };

type Props = {
  value: AnoVendaValue;
  onChange: (value: AnoVendaValue) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

const inputCls = `w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-grafite
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-marinho/20
  focus:border-marinho/40 transition bg-white`;

export default function AnoVendaPicker({ value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  // Rascunho local: só aplica ao confirmar (evita re-busca a cada tecla no futuro).
  const [draft, setDraft] = useState<AnoVendaValue>(value);

  const t = useTranslations('CamposVenda');
  const tComum = useTranslations('Comum');
  const tFiltros = useTranslations('Filtros');
  const label = anoVendaLabel(value, t);
  const anoAtual = new Date().getFullYear();

  function abrir() {
    setDraft(value);
    onOpen();
  }

  function aplicar() {
    // Normaliza faixa invertida (min > max) trocando os extremos.
    let { min, max } = draft;
    if (min && max && parseInt(min) > parseInt(max)) [min, max] = [max, min];
    onChange({ min, max });
    onClose();
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={isOpen ? onClose : abrir}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-marinho bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {t('ano.rotulo')}
        </span>
        {label ? (
          <span className={`font-medium text-grafite whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
            {label}
          </span>
        ) : (
          <span className={`text-slate-400 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>{t('ano.placeholder')}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-72 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            {t('ano.titulo')}
          </p>
          <div className="flex items-center gap-2">
            <input
              className={inputCls}
              type="number"
              min={1900}
              max={anoAtual + 1}
              placeholder={t('ano.de')}
              value={draft.min}
              onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
            />
            <span className="text-slate-400 text-sm shrink-0">{tFiltros('ate')}</span>
            <input
              className={inputCls}
              type="number"
              min={1900}
              max={anoAtual + 1}
              placeholder={t('ano.ate')}
              value={draft.max}
              onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={() => setDraft({ min: '', max: '' })}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              {tComum('limpar')}
            </button>
            <button
              type="button"
              onClick={aplicar}
              className="px-4 py-2 rounded-xl bg-marinho hover:bg-marinho-escuro text-white text-xs font-semibold transition-colors"
            >
              {tComum('aplicar')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
