'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Para botões que navegam com `window.location` (recarga completa): marca o botão como
 * "pendente" no clique — o componente mostra o Spinner e desabilita, evitando cliques repetidos
 * enquanto a rede responde. Se o usuário voltar pelo histórico (bfcache), o estado é limpo.
 */
export function useNavegacaoPendente() {
  const [pendente, setPendente] = useState(false);

  useEffect(() => {
    const aoVoltar = (e: PageTransitionEvent) => {
      if (e.persisted) setPendente(false);
    };
    window.addEventListener('pageshow', aoVoltar);
    return () => window.removeEventListener('pageshow', aoVoltar);
  }, []);

  const navegar = useCallback((url: string) => {
    setPendente(true);
    window.location.assign(url);
  }, []);

  return { pendente, setPendente, navegar };
}
