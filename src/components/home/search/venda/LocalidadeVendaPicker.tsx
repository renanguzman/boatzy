'use client';

import { useMemo, useState } from 'react';
import { MapPin, Check, ChevronLeft, ChevronRight } from 'lucide-react';

/** Linha de vendas_locais: município (com estado) que possui anúncio ativo. */
export type LocalVendaOption = {
  estadoId: number;
  estadoNome: string;
  uf: string;
  municipioId: number;
  municipioNome: string;
  total: number;
};

/** Estado sempre presente; cidade opcional (null = todo o estado). */
export type LocalidadeVendaValue = {
  estadoId: number;
  estadoNome: string;
  uf: string;
  municipioId: number | null;
  municipioNome: string | null;
};

type Props = {
  /** Locais disponíveis (apenas com anúncio ativo), carregados no servidor. */
  options: LocalVendaOption[];
  value: LocalidadeVendaValue | null;
  onChange: (value: LocalidadeVendaValue | null) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

export default function LocalidadeVendaPicker({ options, value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  // Estado sendo navegado no dropdown (etapa 2: escolher a cidade).
  const [estadoAberto, setEstadoAberto] = useState<number | null>(null);

  const estados = useMemo(() => {
    const porId = new Map<number, { estadoId: number; estadoNome: string; uf: string; total: number }>();
    for (const l of options) {
      const atual = porId.get(l.estadoId);
      if (atual) {
        atual.total += l.total;
      } else {
        porId.set(l.estadoId, { estadoId: l.estadoId, estadoNome: l.estadoNome, uf: l.uf, total: l.total });
      }
    }
    return [...porId.values()].sort((a, b) => a.estadoNome.localeCompare(b.estadoNome, 'pt-BR'));
  }, [options]);

  const cidadesDoEstado = useMemo(
    () => options.filter((l) => l.estadoId === estadoAberto),
    [options, estadoAberto],
  );

  const label = value
    ? value.municipioNome
      ? `${value.municipioNome}, ${value.uf}`
      : `${value.estadoNome} (todo o estado)`
    : null;

  function abrir() {
    // Reabre já na lista de cidades quando um estado está selecionado.
    setEstadoAberto(value?.estadoId ?? null);
    onOpen();
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={isOpen ? onClose : abrir}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-slate-800 bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          Localidade
        </span>
        {label ? (
          <span className={`font-medium text-slate-800 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
            {label}
          </span>
        ) : (
          <span className={`text-slate-400 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>Onde? (opcional)</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 w-72 p-2 max-h-80 overflow-y-auto">
          {estadoAberto == null ? (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 pt-2 pb-1">
                Estado
              </p>
              {estados.length === 0 ? (
                <p className="text-sm text-slate-400 px-3 py-3">Nenhuma localidade disponível.</p>
              ) : (
                estados.map((e) => {
                  const active = value?.estadoId === e.estadoId;
                  return (
                    <button
                      key={e.estadoId}
                      type="button"
                      onClick={() => setEstadoAberto(e.estadoId)}
                      className={`w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active ? 'bg-slate-100 font-semibold text-[#0B2447]' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <MapPin className={`h-4 w-4 shrink-0 ${active ? 'text-[#0B3D91]' : 'text-slate-400'}`} />
                      <span className="flex-1 truncate">{e.estadoNome}</span>
                      <span className="text-xs text-slate-400 shrink-0">{e.total}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                    </button>
                  );
                })
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEstadoAberto(null)}
                className="w-full flex items-center gap-1.5 text-left rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-wider"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {estados.find((e) => e.estadoId === estadoAberto)?.estadoNome ?? 'Estados'}
              </button>

              {/* Todo o estado (cidade opcional) */}
              {(() => {
                const est = estados.find((e) => e.estadoId === estadoAberto);
                if (!est) return null;
                const active = value?.estadoId === est.estadoId && value?.municipioId == null;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(active ? null : {
                        estadoId: est.estadoId,
                        estadoNome: est.estadoNome,
                        uf: est.uf,
                        municipioId: null,
                        municipioNome: null,
                      });
                      onClose();
                    }}
                    className={`w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active ? 'bg-slate-100 font-semibold text-[#0B2447]' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className={`h-4 w-4 shrink-0 ${active ? 'text-[#0B3D91]' : 'text-slate-400'}`} />
                    <span className="flex-1 truncate">Todo o estado</span>
                    {active && <Check className="h-4 w-4 text-[#0B3D91] shrink-0" />}
                  </button>
                );
              })()}

              {cidadesDoEstado.map((c) => {
                const active = value?.municipioId === c.municipioId;
                return (
                  <button
                    key={c.municipioId}
                    type="button"
                    onClick={() => {
                      onChange(active ? null : {
                        estadoId: c.estadoId,
                        estadoNome: c.estadoNome,
                        uf: c.uf,
                        municipioId: c.municipioId,
                        municipioNome: c.municipioNome,
                      });
                      onClose();
                    }}
                    className={`w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active ? 'bg-slate-100 font-semibold text-[#0B2447]' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-4 shrink-0" />
                    <span className="flex-1 truncate">{c.municipioNome}</span>
                    <span className="text-xs text-slate-400 shrink-0">{c.total}</span>
                    {active && <Check className="h-4 w-4 text-[#0B3D91] shrink-0" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
