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
  const { addons, selectedIds, toggle, selectedAddons, precoCliente } = useCart();
  const [open, setOpen] = useState(false);

  if (addons.length === 0) return null;

  const hasSelection = selectedAddons.length > 0;

  // Menor adicional pago (com a taxa embutida): dá concretude ao convite.
  const menorPreco = addons.filter((a) => a.preco > 0).reduce<number | null>(
    (min, a) => (min == null || a.preco < min ? a.preco : min), null);
  const totalSelecionado = selectedAddons.reduce((soma, a) => soma + precoCliente(a.preco), 0);

  return (
    <div className={`mb-4 rounded-2xl border overflow-hidden transition-shadow ${
      hasSelection
        ? 'border-marinho/40 bg-marinho/[0.04]'
        : 'border-turquesa/40 bg-gradient-to-br from-turquesa/10 via-white to-marinho/[0.06] shadow-sm hover:shadow-md'
    }`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/60"
      >
        {/* Ícone cheio na cor da marca — o "ponto focal" do card */}
        <div className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-marinho to-turquesa shadow-md shadow-marinho/25 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-white" />
          {!hasSelection && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-turquesa opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-turquesa ring-2 ring-white" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-marinho leading-snug">
            {hasSelection ? 'Seu passeio está ficando inesquecível' : 'Deixe seu passeio inesquecível!'}
          </p>
          <p className={`text-xs leading-snug mt-0.5 ${hasSelection ? 'font-semibold text-marinho' : 'text-slate-600'}`}>
            {hasSelection
              ? `${selectedAddons.length} selecionado${selectedAddons.length > 1 ? 's' : ''} · ${formatCurrency(totalSelecionado)}`
              : `${addons.length} ${addons.length > 1 ? 'opcionais' : 'opcional'} para turbinar a experiência${menorPreco != null ? ` · a partir de ${formatCurrency(precoCliente(menorPreco))}` : ''}`}
          </p>
          <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-marinho">
            {open ? 'Ocultar opcionais' : hasSelection ? 'Editar opcionais' : 'Clique para ver os opcionais'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </span>
        </div>
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
                      ? 'border-marinho bg-white shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-marinho/10' : 'bg-slate-100'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${selected ? 'text-marinho' : 'text-slate-500'}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold leading-snug ${
                        selected ? 'text-marinho' : 'text-slate-700'
                      }`}
                    >
                      {item.descricao}
                    </p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                      {item.tipo === 'servico' ? 'Serviço' : 'Produto'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-xs font-bold ${selected ? 'text-marinho' : 'text-slate-700'}`}>
                      {item.preco > 0 ? formatCurrency(precoCliente(item.preco)) : 'Incluso'}
                    </span>
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                        selected ? 'bg-marinho text-white scale-110' : 'bg-slate-100 text-slate-400'
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
