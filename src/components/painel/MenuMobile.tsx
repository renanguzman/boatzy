'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type MenuMobileCtx = {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
};

const MenuMobileContext = createContext<MenuMobileCtx>({
  aberto: false,
  abrir: () => {},
  fechar: () => {},
  alternar: () => {},
});

export function useMenuMobile() {
  return useContext(MenuMobileContext);
}

/**
 * Estado do menu lateral do painel em telas < lg, onde a Sidebar vira um
 * drawer. Fecha sozinho ao trocar de rota, com Esc e ao voltar para o desktop;
 * enquanto aberto, trava a rolagem do body (inclusive no Safari do iOS).
 */
export function MenuMobileProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);
  const alternar = useCallback(() => setAberto((a) => !a), []);

  // Navegou → fecha o drawer (ajuste de estado durante o render, sem efeito).
  const [rotaAnterior, setRotaAnterior] = useState(pathname);
  if (rotaAnterior !== pathname) {
    setRotaAnterior(pathname);
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onDesktop = () => desktop.matches && setAberto(false);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [aberto]);

  const valor = useMemo(() => ({ aberto, abrir, fechar, alternar }), [aberto, abrir, fechar, alternar]);

  return <MenuMobileContext.Provider value={valor}>{children}</MenuMobileContext.Provider>;
}
