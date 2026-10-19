'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { precoComTaxa } from '@/lib/pagamentos/valores';

export type CartAddon = {
  id: string;
  descricao: string;
  preco: number;
  tipo: string;
};

type CartContextValue = {
  addons: CartAddon[];
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  selectedAddons: CartAddon[];
  /** Soma dos adicionais pelo preço do gestor — entra na conta do pedido. */
  totalAdicionais: number;
  /** Preço de exibição de um adicional: com a taxa embutida (o cliente não vê a taxa). */
  precoCliente: (preco: number) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children, addons, taxaPercent,
}: {
  children: ReactNode;
  addons: CartAddon[];
  /** Taxa de serviço (%) do gestor dono — só para exibir os preços com ela embutida. */
  taxaPercent: number;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedAddons = addons.filter((a) => selectedIds.has(a.id));
  const totalAdicionais = selectedAddons.reduce((sum, a) => sum + a.preco, 0);
  const precoCliente = (preco: number) => precoComTaxa(preco, taxaPercent);

  return (
    <CartContext.Provider value={{ addons, selectedIds, toggle, selectedAddons, totalAdicionais, precoCliente }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
