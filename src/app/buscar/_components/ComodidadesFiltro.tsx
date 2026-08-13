'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ListFilter, Search } from 'lucide-react';
import { buildBuscarUrl, parseComodidadeIds, type BuscaSearchParams } from '../_lib/filtros';

export type ComodidadeOption = { id: string; nome: string };

type Props = {
  /** Params atuais da URL — vêm da página (Server Component), não de useSearchParams. */
  params: BuscaSearchParams;
  /** Todas as comodidades disponíveis para o filtro. */
  comodidades: ComodidadeOption[];
};

/** Remove acentos para a busca dentro da lista não depender de digitação exata. */
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function ComodidadesFiltro({ params, comodidades }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selecionadosUrl = useMemo(() => parseComodidadeIds(params.comodidades), [params.comodidades]);
  const [draft, setDraft] = useState<string[]>(selecionadosUrl);

  // Abrir sempre parte do que está na URL — mesmo padrão do FiltrosAvancados.
  function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setDraft(selecionadosUrl);
    setBusca('');
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

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function aplicar() {
    router.push(
      buildBuscarUrl(params, {
        comodidades: draft.length > 0 ? draft.join(',') : null,
        pagina: null, // mudou o filtro: volta para a primeira página
      }),
    );
    setAberto(false);
  }

  function limpar() {
    setDraft([]);
  }

  const listaFiltrada = busca.trim()
    ? comodidades.filter((c) => normalizar(c.nome).includes(normalizar(busca)))
    : comodidades;

  if (comodidades.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={alternar}
        className={`flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1.5 border transition-colors cursor-pointer ${
          aberto || selecionadosUrl.length > 0
            ? 'border-[#0B2447] text-[#0B2447] bg-white'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
        aria-expanded={aberto}
      >
        <ListFilter className="h-3.5 w-3.5" />
        Comodidades
        {selecionadosUrl.length > 0 && (
          <span className="h-4 w-4 rounded-full bg-[#0B2447] text-white text-[10px] font-bold flex items-center justify-center">
            {selecionadosUrl.length}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 bg-white
            rounded-2xl shadow-2xl border border-slate-100 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)] p-4"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Comodidades desejadas
          </p>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-800
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20
                focus:border-[#0B2447]/40 transition bg-white"
              placeholder="Buscar comodidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {listaFiltrada.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma comodidade encontrada.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5 max-h-56 overflow-y-auto pr-1 -mr-1">
              {listaFiltrada.map((c) => {
                const checked = draft.includes(c.id);
                return (
                  <label
                    key={c.id}
                    title={c.nome}
                    className="flex items-center gap-2 py-1.5 px-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggle(c.id)}
                    />
                    <span
                      className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                        checked ? 'bg-[#0B2447] border-[#0B2447]' : 'bg-white border-slate-300'
                      }`}
                    >
                      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="text-sm text-slate-700 truncate">{c.nome}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
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
              Aplicar{draft.length > 0 ? ` (${draft.length})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
