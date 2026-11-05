'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Etapa e etapas visitadas — o que o rascunho automático guarda do wizard. */
export type EstadoEtapas = { atual: number; visitadas: boolean[] };

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
 * - Histórico do navegador (SPEC §107.1): cada troca de etapa grava `#id` no
 *   histórico (`pushState`, integrado ao router do Next), então o "voltar" do
 *   navegador/celular volta para a etapa anterior em vez de sair do cadastro.
 *   Entrada sem `#` = primeira etapa.
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
  const atualRef = useRef(0);
  const idsChave = ids.join('|');

  const ir = useCallback((i: number, { historico = true }: { historico?: boolean } = {}) => {
    const alvo = Math.max(0, Math.min(total - 1, i));
    atualRef.current = alvo;
    setAtual(alvo);
    setVisitadas(prev => prev.map((v, idx) => v || idx === alvo));
    const id = idsChave ? idsChave.split('|')[alvo] : '';
    if (historico && id && window.location.hash !== `#${id}`) {
      window.history.pushState(null, '', `#${id}`);
    }
    requestAnimationFrame(() =>
      topoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [total, idsChave]);

  /**
   * Volta a etapa salva num rascunho. Se a página foi aberta por um link direto
   * (`#etapa` válido), a etapa do link vale — o rascunho só soma as visitadas.
   */
  const restaurar = useCallback((salvo: EstadoEtapas) => {
    if (salvo.visitadas.length === total) {
      setVisitadas(prev => prev.map((v, idx) => v || !!salvo.visitadas[idx]));
    }
    const lista = idsChave ? idsChave.split('|') : [];
    const doHash = lista.indexOf(window.location.hash.replace('#', ''));
    if (doHash >= 0 || salvo.atual === atualRef.current) return;
    ir(salvo.atual);
  }, [total, idsChave, ir]);

  // Abre a etapa indicada no hash da URL — ao abrir a página (atalho "Definir preço"
  // da listagem), quando um link da própria página muda o hash ("Enviar documento" do
  // aviso) e quando o gestor usa o voltar/avançar do navegador entre as etapas.
  useEffect(() => {
    if (!idsChave) return;
    const lista = idsChave.split('|');
    const indiceDoHash = () => {
      const hash = window.location.hash.replace('#', '');
      return hash ? lista.indexOf(hash) : 0;
    };
    const raf = requestAnimationFrame(() => {
      const i = indiceDoHash();
      if (i > 0) ir(i, { historico: false });
    });
    const aoMudar = () => {
      const i = indiceDoHash();
      if (i >= 0 && i !== atualRef.current) ir(i, { historico: false });
    };
    // popstate cobre o voltar/avançar; hashchange, os links `#etapa` da página.
    window.addEventListener('popstate', aoMudar);
    window.addEventListener('hashchange', aoMudar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('popstate', aoMudar);
      window.removeEventListener('hashchange', aoMudar);
    };
  }, [idsChave, ir]);

  return {
    atual,
    visitadas,
    topoRef,
    ir,
    restaurar,
    proxima: () => ir(atual + 1),
    anterior: () => ir(atual - 1),
    ehPrimeira: atual === 0,
    ehUltima: atual === total - 1,
  };
}
