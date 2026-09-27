'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Navegação de um cadastro em etapas (wizard) do painel.
 *
 * - `atual`: índice da etapa visível.
 * - `visitadas`: etapas por onde o gestor já passou — o indicador mostra ✓ nas
 *   visitadas que não são a atual. Na edição, todas começam visitadas (os
 *   dados já existem).
 * - Navegação livre: qualquer etapa pode ser aberta a qualquer momento.
 * - Ao trocar de etapa, rola até o topo do cadastro (`topoRef`).
 * - Link direto: `…/editar#preco` abre a etapa cujo `id` é `preco` (`ids`).
 */
export function useEtapas(
  total: number,
  { todasVisitadas = false, ids = [] as string[] } = {},
) {
  const [atual, setAtual] = useState(0);
  const [visitadas, setVisitadas] = useState<boolean[]>(
    () => Array.from({ length: total }, (_, i) => todasVisitadas || i === 0),
  );
  const topoRef = useRef<HTMLDivElement>(null);

  const ir = useCallback((i: number) => {
    const alvo = Math.max(0, Math.min(total - 1, i));
    setAtual(alvo);
    setVisitadas(prev => prev.map((v, idx) => v || idx === alvo));
    requestAnimationFrame(() =>
      topoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [total]);

  // Abre a etapa indicada no hash da URL (ex.: atalho "Definir preço" da listagem).
  const idsChave = ids.join('|');
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const i = idsChave ? idsChave.split('|').indexOf(hash) : -1;
    if (i <= 0) return;
    const raf = requestAnimationFrame(() => ir(i));
    return () => cancelAnimationFrame(raf);
  }, [idsChave, ir]);

  return {
    atual,
    visitadas,
    topoRef,
    ir,
    proxima: () => ir(atual + 1),
    anterior: () => ir(atual - 1),
    ehPrimeira: atual === 0,
    ehUltima: atual === total - 1,
  };
}
