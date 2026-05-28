'use client';

import { Package, Wrench, Plus, Check } from 'lucide-react';
import { useCart } from './CartContext';
import { formatCurrency } from '@/lib/utils';

export default function AddonsSection() {
  const { addons, selectedIds, toggle } = useCart();

  if (addons.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-[#0B2447] mb-1">Personalize seu roteiro</h2>
      <p className="text-sm text-slate-500 mb-5">
        Selecione os adicionais que deseja incluir no pedido — todos são opcionais.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addons.map((item) => {
          const selected = selectedIds.has(item.id);
          const Icon = item.tipo === 'servico' ? Wrench : Package;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`text-left p-4 rounded-2xl border-2 transition-all duration-150 cursor-pointer ${
                selected
                  ? 'border-[#0B3D91] bg-[#0B3D91]/5 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selected ? 'bg-[#0B3D91]/10' : 'bg-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${selected ? 'text-[#0B3D91]' : 'text-slate-500'}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold leading-snug ${
                      selected ? 'text-[#0B2447]' : 'text-slate-700'
                    }`}
                  >
                    {item.descricao}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                    {item.tipo === 'servico' ? 'Serviço' : 'Produto'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-sm font-bold ${selected ? 'text-[#0B3D91]' : 'text-slate-700'}`}>
                    {item.preco > 0 ? formatCurrency(item.preco) : 'Incluso'}
                  </span>
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                      selected
                        ? 'bg-[#0B3D91] text-white scale-110'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {selected ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
