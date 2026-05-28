'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

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
  totalAdicionais: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children, addons }: { children: ReactNode; addons: CartAddon[] }) {
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

  return (
    <CartContext.Provider value={{ addons, selectedIds, toggle, selectedAddons, totalAdicionais }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
