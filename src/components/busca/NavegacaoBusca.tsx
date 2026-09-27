'use client';

import { createContext, useCallback, useContext, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Navegação das páginas de busca (/buscar e /vendas). Os filtros ficam na URL
 * e a página (Server Component) refaz a busca; aqui só empurramos a nova URL
 * dentro de uma transição, para que o painel mostre "Atualizando…" e a área
 * de resultados fique esmaecida enquanto o servidor responde.
 */
type Navegacao = { ir: (url: string) => void; pendente: boolean };

const Ctx = createContext<Navegacao | null>(null);

export function NavegacaoBuscaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const ir = useCallback(
    (url: string) => startTransition(() => router.push(url, { scroll: false })),
    [router],
  );
  return <Ctx.Provider value={{ ir, pendente }}>{children}</Ctx.Provider>;
}

export function useNavegacaoBusca(): Navegacao {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNavegacaoBusca precisa de <NavegacaoBuscaProvider>.');
  return ctx;
}

/** Envolve a lista de resultados: esmaece enquanto uma nova busca carrega. */
export function AreaResultados({ children }: { children: React.ReactNode }) {
  const { pendente } = useNavegacaoBusca();
  return (
    <div
      aria-busy={pendente}
      className={`transition-opacity duration-200 ${pendente ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
    >
      {children}
    </div>
  );
}
