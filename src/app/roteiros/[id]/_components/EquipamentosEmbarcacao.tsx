'use client';

import { useId, useState } from 'react';
import { Check, ChevronDown, ListChecks, ShieldCheck, Sofa, Waves } from 'lucide-react';

// Ícone por chave: a view que monta as categorias é Server Component e não pode passar
// componentes (funções) como prop para este Client Component.
const ICONES = { seguranca: ShieldCheck, acessorios: Waves, comodidades: Sofa };

export type CategoriaEquipamentos = {
  titulo: string;
  /** Rótulo da contagem no resumo fechado, no singular e no plural (ex.: "acessório"/"acessórios"). */
  singular: string;
  plural: string;
  icone: keyof typeof ICONES;
  itens: string[];
};

type Props = {
  categorias: CategoriaEquipamentos[];
};

/**
 * Accordion "Equipamentos e Acessórios da embarcação" dentro de "Sobre a Embarcação": fechado
 * mostra só o resumo das contagens; aberto lista os itens separados por categoria.
 */
export default function EquipamentosEmbarcacao({ categorias }: Props) {
  const [aberto, setAberto] = useState(false);
  const idConteudo = useId();

  const visiveis = categorias.filter((c) => c.itens.length > 0);
  if (visiveis.length === 0) return null;

  const resumo = visiveis
    .map((c) => `${c.itens.length} ${c.itens.length === 1 ? c.singular : c.plural}`)
    .join(' · ');

  return (
    <div className="mt-5 rounded-xl border border-slate-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={idConteudo}
        className="group w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl transition-colors hover:bg-slate-50/70 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marinho/25"
      >
        <span className="h-10 w-10 rounded-xl bg-turquesa/10 flex items-center justify-center shrink-0">
          <ListChecks className="h-5 w-5 text-turquesa-escuro" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-marinho leading-snug">
            Equipamentos e Acessórios da embarcação
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">{resumo}</span>
        </span>
        <span
          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            aberto ? 'bg-marinho text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-marinho/10 group-hover:text-marinho'
          }`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Expansão via grid-rows para altura automática, sem JS medindo o conteúdo. */}
      <div
        id={idConteudo}
        inert={!aberto}
        className={`grid transition-all duration-300 ease-in-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          {/* Ficha técnica: rótulo da categoria em caixa alta (padrão das specs do site) e itens em
              linhas de mesma altura com filete, 2 colunas a partir do sm. */}
          <div className="border-t border-slate-100 px-4 sm:px-5 pt-5 pb-6 space-y-7">
            {visiveis.map(({ titulo, icone, itens }) => {
              const Icone = ICONES[icone];
              return (
                <section key={titulo}>
                  <h3 className="flex items-center gap-2 pb-2">
                    <Icone className="h-3.5 w-3.5 text-marinho" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-marinho">{titulo}</span>
                    <span className="ml-auto text-[11px] font-medium text-slate-400 tabular-nums">
                      {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                    </span>
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
                    {itens.map((nome) => (
                      <li
                        key={nome}
                        className="flex items-center gap-2.5 min-h-10 py-2 border-t border-slate-100 text-sm text-slate-700"
                      >
                        <Check className="h-3.5 w-3.5 text-turquesa-escuro shrink-0" strokeWidth={2.5} />
                        <span className="leading-snug">{nome}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
