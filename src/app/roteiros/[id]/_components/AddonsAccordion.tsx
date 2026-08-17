'use client';

import { useState } from 'react';
import { ChevronDown, Sparkles, Package, Wrench, Plus, Check } from 'lucide-react';
import { useCart } from './CartContext';
import { formatCurrency } from '@/lib/utils';

/**
 * Seletor de adicionais (produtos/serviços do catálogo) dentro do card de
 * reserva — accordion fechado por padrão, com um cabeçalho chamativo e
 * persuasivo ("Deixe seu passeio inesquecível!") que convida o clique; depois
 * de selecionados, o cabeçalho passa a mostrar quantos e quanto somam, para
 * deixar claro que eles entram no preço total mesmo com o accordion fechado.
 */
export default function AddonsAccordion() {
  const { addons, selectedIds, toggle, selectedAddons, totalAdicionais } = useCart();
  const [open, setOpen] = useState(false);

  if (addons.length === 0) return null;

  const hasSelection = selectedAddons.length > 0;

  return (
    <div className="mb-4 rounded-xl border border-dashed border-[#0B3D91]/40 bg-gradient-to-br from-[#0B3D91]/5 to-cyan-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-[#0B3D91]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0B2447] leading-snug">
              {hasSelection ? 'Torne seu passeio inesquecível' : 'Deixe seu passeio inesquecível!'}
            </p>
            <p className={`text-xs ${hasSelection ? 'font-semibold text-[#0B3D91]' : 'text-slate-500'}`}>
              {hasSelection
                ? `${selectedAddons.length} selecionado${selectedAddons.length > 1 ? 's' : ''} · ${formatCurrency(totalAdicionais)}`
                : `Este roteiro tem ${addons.length} ${addons.length > 1 ? 'opcionais' : 'opcional'} para você. Clique e confira!`}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#0B3D91] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expansão via grid-rows para altura automática, sem JS medindo o conteúdo. */}
      <div className={`grid transition-all duration-200 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3 space-y-2">
            {!hasSelection && (
              <p className="px-1 pb-1 text-[11px] text-slate-500">
                Todos são opcionais e somam ao total estimado da reserva.
              </p>
            )}
            {addons.map((item) => {
              const selected = selectedIds.has(item.id);
              const Icon = item.tipo === 'servico' ? Wrench : Package;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-[#0B3D91] bg-white shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-[#0B3D91]/10' : 'bg-slate-100'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${selected ? 'text-[#0B3D91]' : 'text-slate-500'}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold leading-snug ${
                        selected ? 'text-[#0B2447]' : 'text-slate-700'
                      }`}
                    >
                      {item.descricao}
                    </p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                      {item.tipo === 'servico' ? 'Serviço' : 'Produto'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-xs font-bold ${selected ? 'text-[#0B3D91]' : 'text-slate-700'}`}>
                      {item.preco > 0 ? formatCurrency(item.preco) : 'Incluso'}
                    </span>
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                        selected ? 'bg-[#0B3D91] text-white scale-110' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
