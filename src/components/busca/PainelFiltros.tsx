'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, SlidersHorizontal, X } from 'lucide-react';
import { useNavegacaoBusca } from './NavegacaoBusca';

type Props = {
  /** Quantos grupos de filtro estão ativos (badge + "Limpar tudo"). */
  ativos: number;
  /** URL sem nenhum filtro (mantém aba/ordenação). */
  limparHref: string;
  /** Total de resultados da busca atual — botão "Ver N resultados" no celular. */
  totalResultados: number;
  children: React.ReactNode;
};

/**
 * Painel de filtros das buscas. Desktop (≥ lg): coluna lateral sempre visível.
 * Celular/tablet: botão "Filtros" que abre o MESMO painel como gaveta em tela
 * cheia, com "Ver N resultados" no rodapé. Os filtros se aplicam na hora
 * (a página atualiza por trás), então a gaveta só precisa ser fechada.
 */
export default function PainelFiltros({ ativos, limparHref, totalResultados, children }: Props) {
  const { pendente, ir } = useNavegacaoBusca();
  const [aberto, setAberto] = useState(false);

  // Gaveta aberta: Esc fecha e a página de trás não rola.
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberto]);

  const cabecalho = (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-lg bg-[#0B2447]/[0.06] flex items-center justify-center">
          <SlidersHorizontal className="h-4 w-4 text-[#0B2447]" />
        </span>
        <h2 className="text-base font-bold text-[#0B2447]">Filtros</h2>
        {ativos > 0 && (
          <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#0B2447] text-white text-[11px] font-bold flex items-center justify-center">
            {ativos}
          </span>
        )}
        {pendente && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Atualizando resultados" />}
      </div>
      <div className="flex items-center gap-1">
        {ativos > 0 && (
          <Link
            href={limparHref}
            scroll={false}
            onClick={(e) => { e.preventDefault(); ir(limparHref); }}
            className="text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] px-2 py-1.5 rounded-lg hover:bg-slate-50"
          >
            Limpar tudo
          </Link>
        )}
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="lg:hidden h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
          aria-label="Fechar filtros"
        >
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Gatilho (celular/tablet) */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="lg:hidden w-full mb-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3
          text-sm font-semibold text-[#0B2447] shadow-sm hover:bg-slate-50"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtros
        {ativos > 0 && (
          <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#0B2447] text-white text-[11px] font-bold flex items-center justify-center">
            {ativos}
          </span>
        )}
      </button>

      <div className={aberto ? 'fixed inset-0 z-[60] lg:static lg:z-auto' : 'hidden lg:block'}>
        {aberto && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] lg:hidden" onClick={() => setAberto(false)} aria-hidden />
        )}
        <aside
          aria-label="Filtros da busca"
          className={`bg-white lg:rounded-2xl lg:border lg:border-slate-100 lg:shadow-sm
            ${aberto ? 'absolute inset-0 sm:left-auto sm:w-[26rem] flex flex-col lg:static lg:w-auto lg:block' : ''}`}
        >
          {cabecalho}
          <div className={aberto ? 'flex-1 overflow-y-auto lg:overflow-visible' : ''}>
            {children}
          </div>
          {aberto && (
            <div className="lg:hidden border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="w-full h-12 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
                {totalResultados > 0
                  ? `Ver ${totalResultados} resultado${totalResultados !== 1 ? 's' : ''}`
                  : 'Nenhum resultado — ajuste os filtros'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
