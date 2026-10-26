'use client';

import { useTranslations } from 'next-intl';
import { useCatalogo } from '@/i18n/CatalogoProvider';
import { Ship, Check } from 'lucide-react';

export type TipoEmbarcacaoValue = { id: string; nome: string };

type Props = {
  /** Tipos disponíveis (apenas os com roteiro ativo vinculado), carregados no servidor. */
  options: TipoEmbarcacaoValue[];
  value: TipoEmbarcacaoValue | null;
  onChange: (value: TipoEmbarcacaoValue | null) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

export default function TipoEmbarcacaoPicker({ options, value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  const t = useTranslations('CamposBusca.tipoEmbarcacao');
  const { traduzir, ordenar } = useCatalogo();
  return (
    <div className="relative min-w-0">
      {/* Field trigger */}
      <button
        type="button"
        onClick={isOpen ? onClose : onOpen}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-marinho bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {t('rotulo')}
        </span>
        {value ? (
          <span className={`font-medium text-grafite whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
            {traduzir('tipo', value.nome)}
          </span>
        ) : (
          <span className={`text-slate-400 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>{t('placeholder')}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-64 p-2 max-h-80 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 pt-2 pb-1">
            {t('titulo')}
          </p>
          {options.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-3">{t('nenhum')}</p>
          ) : (
            ordenar(options, 'tipo').map((tipo) => {
              const active = value?.id === tipo.id;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => {
                    onChange(active ? null : tipo);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active ? 'bg-slate-100 font-semibold text-marinho' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Ship className={`h-4 w-4 shrink-0 ${active ? 'text-marinho' : 'text-slate-400'}`} />
                  <span className="flex-1 truncate">{traduzir('tipo', tipo.nome)}</span>
                  {active && <Check className="h-4 w-4 text-marinho shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
