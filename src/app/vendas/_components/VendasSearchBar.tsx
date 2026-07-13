'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import SearchTypeToggle, { type SearchType } from '@/components/home/search/SearchTypeToggle';
import TipoVendaPicker, { type TipoVendaOption } from '@/components/home/search/venda/TipoVendaPicker';
import LocalidadeVendaPicker, { type LocalVendaOption, type LocalidadeVendaValue } from '@/components/home/search/venda/LocalidadeVendaPicker';
import AnoVendaPicker, { type AnoVendaValue } from '@/components/home/search/venda/AnoVendaPicker';
import ValorVendaPicker, { type ValorVendaValue } from '@/components/home/search/venda/ValorVendaPicker';
import { buildVendaSearchUrl } from '@/components/home/search/venda/build-url';

type ActivePanel = 'tipo' | 'localidade' | 'ano' | 'valor' | null;

type Props = {
  tipos: TipoVendaOption[];
  locais: LocalVendaOption[];
  initialTipo?: TipoVendaOption | null;
  initialLocalidade?: LocalidadeVendaValue | null;
  initialAno?: AnoVendaValue;
  initialValor?: ValorVendaValue;
};

export default function VendasSearchBar({
  tipos,
  locais,
  initialTipo = null,
  initialLocalidade = null,
  initialAno = { min: '', max: '' },
  initialValor = { min: '', max: '' },
}: Props) {
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoVendaOption | null>(initialTipo);
  const [localidade, setLocalidade] = useState<LocalidadeVendaValue | null>(initialLocalidade);
  const [ano, setAno] = useState<AnoVendaValue>(initialAno);
  const [valor, setValor] = useState<ValorVendaValue>(initialValor);
  const [active, setActive] = useState<ActivePanel>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function open(panel: ActivePanel) {
    setActive((prev) => (prev === panel ? null : panel));
  }

  function handleSearch() {
    if (!tipo) {
      setActive('tipo');
      return;
    }
    router.push(buildVendaSearchUrl({ tipo, localidade, ano, valor }));
    setActive(null);
  }

  function handleTypeChange(type: SearchType) {
    // Sair da aba Vendas volta à busca de roteiros/embarcações (filtros de
    // venda são descartados — são domínios diferentes).
    if (type === 'roteiro') router.push('/buscar');
    if (type === 'embarcacao') router.push('/buscar?tipo=embarcacao');
  }

  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-3">
      <SearchTypeToggle value="venda" onChange={handleTypeChange} variant="light" />

      <div
        ref={containerRef}
        className="bg-white border border-slate-200 rounded-2xl shadow-sm px-1 py-1 flex items-center gap-1 w-full"
      >
        {/* Tipo (obrigatório) */}
        <div className="flex-1 relative min-w-0">
          <TipoVendaPicker
            options={tipos}
            value={tipo}
            onChange={setTipo}
            isOpen={active === 'tipo'}
            onOpen={() => open('tipo')}
            onClose={() => setActive(null)}
            compact
          />
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Localidade */}
        <div className="flex-1 relative min-w-0">
          <LocalidadeVendaPicker
            options={locais}
            value={localidade}
            onChange={setLocalidade}
            isOpen={active === 'localidade'}
            onOpen={() => open('localidade')}
            onClose={() => setActive(null)}
            compact
          />
          {localidade && (
            <button
              type="button"
              onClick={() => setLocalidade(null)}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="h-3 w-3 text-slate-500" />
            </button>
          )}
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Ano */}
        <div className="flex-1 relative min-w-0">
          <AnoVendaPicker
            value={ano}
            onChange={setAno}
            isOpen={active === 'ano'}
            onOpen={() => open('ano')}
            onClose={() => setActive(null)}
            compact
          />
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Valor + Buscar */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative min-w-0">
            <ValorVendaPicker
              value={valor}
              onChange={setValor}
              isOpen={active === 'valor'}
              onOpen={() => open('valor')}
              onClose={() => setActive(null)}
              compact
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="bg-[#0B3D91] hover:bg-[#092E6E] text-white rounded-xl p-2.5 flex items-center justify-center transition-all hover:shadow-md hover:scale-[1.04] active:scale-[0.97] cursor-pointer"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
