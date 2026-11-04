'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, X, Check } from 'lucide-react';

const STORAGE_KEY = 'boatzy:catalogo-orientacao-oculta';

const EXEMPLOS = [
  {
    descricao: 'Churrasco para 5 pessoas — linguiça, carne, 3 packs de cerveja, carvão e acompanhamentos',
    valor: 'R$ 500,00',
  },
  {
    descricao: 'Churrasco para 10 pessoas — linguiça, carne, 6 packs de cerveja, carvão e acompanhamentos',
    valor: 'R$ 900,00',
  },
];

/**
 * Orientação ao gestor sobre como cadastrar extras (ex.: churrasco).
 * Abre sozinha na primeira visita; "Não mostrar novamente" grava em localStorage.
 * O botão "Dicas de cadastro" reabre a qualquer momento.
 */
export default function OrientacaoCatalogo() {
  const [aberto, setAberto] = useState(false);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    let oculta = true;
    try {
      oculta = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* storage bloqueado: não insiste */
    }
    if (!oculta) setAberto(true);
  }, []);

  const fechar = useCallback(() => {
    setAberto(false);
    if (naoMostrar) {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignora */
      }
    }
  }, [naoMostrar]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto, fechar]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNaoMostrar(false);
          setAberto(true);
        }}
        className="flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2447] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
      >
        <Lightbulb className="w-4 h-4" />
        Dicas de cadastro
      </button>

      {montado && aberto && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={fechar}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="orientacao-catalogo-titulo"
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-5 h-5" />
                </span>
                <h2 id="orientacao-catalogo-titulo" className="text-base font-bold text-[#0B2447]">
                  Como cadastrar seus extras
                </h2>
              </div>
              <button type="button" onClick={fechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 text-sm text-slate-600">
              <p>
                O cliente <strong>escolhe cada extra como um item único</strong>, sem informar quantidade.
                Por isso, itens como o <strong>churrasco</strong> devem ser cadastrados como{' '}
                <strong>pacotes fechados</strong>, um item para cada tamanho.
              </p>
              <p>Na descrição, informe sempre:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>para <strong>quantas pessoas</strong> o pacote serve;</li>
                <li><strong>o que está incluído</strong> (carnes, bebidas, acompanhamentos…);</li>
                <li>no campo Valor, o <strong>preço total do pacote</strong>.</li>
              </ul>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Exemplo</p>
                {EXEMPLOS.map(ex => (
                  <div key={ex.descricao} className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="text-slate-700">{ex.descricao}</span>
                    <span className="font-semibold text-[#0B2447] whitespace-nowrap">{ex.valor}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400">
                Assim o cliente entende exatamente o que está contratando e não fica dúvida na hora de escolher.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-5 pb-5">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={naoMostrar}
                  onChange={e => setNaoMostrar(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-[#0B2447]"
                />
                Não mostrar novamente
              </label>
              <button
                type="button"
                onClick={fechar}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition-colors"
              >
                <Check className="w-4 h-4" /> Entendi
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
