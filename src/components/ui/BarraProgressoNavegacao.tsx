'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type Fase = 'parado' | 'andando' | 'concluindo';

const EVENTO_INICIO = 'boatzy:navegacao-inicio';

/** Acende a barra para navegações que não vêm de um <a> (router.push em botões, sair etc.). */
export function iniciarBarraNavegacao() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_INICIO));
}

/**
 * Faixa fina turquesa no topo da tela durante navegações internas. Começa no clique em qualquer
 * link do site (feedback imediato, mesmo quando a rota ainda está carregando) e termina quando
 * a URL muda. Não intercepta o clique: só observa.
 */
export default function BarraProgressoNavegacao() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chave = `${pathname}?${searchParams.toString()}`;
  const [fase, setFase] = useState<Fase>('parado');
  const chaveAoIniciar = useRef(chave);
  const limite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const encerrar = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function limpar() {
      if (limite.current) clearTimeout(limite.current);
      if (encerrar.current) clearTimeout(encerrar.current);
    }

    function iniciar() {
      limpar();
      chaveAoIniciar.current = `${window.location.pathname}?${window.location.search.replace(/^\?/, '')}`;
      setFase('andando');
      // Rede de segurança: se a URL nunca mudar (erro), some sozinha.
      limite.current = setTimeout(() => setFase('parado'), 20000);
    }

    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let destino: URL;
      try {
        destino = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (destino.origin !== window.location.origin) return;
      // Mesma página (inclusive só mudando o #âncora): nada a carregar.
      if (destino.pathname === window.location.pathname && destino.search === window.location.search) return;

      iniciar();
    }

    document.addEventListener('click', aoClicar, true);
    window.addEventListener(EVENTO_INICIO, iniciar);
    return () => {
      document.removeEventListener('click', aoClicar, true);
      window.removeEventListener(EVENTO_INICIO, iniciar);
      limpar();
    };
  }, []);

  // A URL mudou: completa a barra e some.
  useEffect(() => {
    if (chave === chaveAoIniciar.current) return;
    chaveAoIniciar.current = chave;
    if (limite.current) clearTimeout(limite.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reação à troca de rota (sistema externo: router)
    setFase((f) => (f === 'andando' ? 'concluindo' : f));
    encerrar.current = setTimeout(() => setFase('parado'), 350);
  }, [chave]);

  if (fase === 'parado') return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className={`h-full rounded-r-full bg-turquesa shadow-[0_0_8px_rgba(23,181,176,0.6)] ${
          fase === 'andando' ? 'barra-nav-andando' : 'barra-nav-concluindo'
        }`}
      />
    </div>
  );
}
