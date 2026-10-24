'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Marca `data-montado="true"` quando o topo do bloco passa de 60% da altura
 * da tela — já no campo de visão, não quando só aparece na borda de baixo
 * (aí a animação acabava antes de o usuário olhar). Uma vez só. Os
 * filhos animam com variantes `group-data-[montado=true]/montagem:` — por isso
 * o wrapper já leva a classe `group/montagem`. Sem IntersectionObserver ou com
 * `prefers-reduced-motion`, monta direto (sem animação).
 */
export default function MontagemAoRolar({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMontado(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setMontado(true);
          obs.disconnect();
        }
      },
      // Encolhe a área observada em 40% por baixo: dispara com o topo do bloco
      // na linha dos 60% da tela (também funciona com bloco maior que a tela).
      { rootMargin: '0px 0px -40% 0px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} data-montado={montado} className={`group/montagem ${className}`}>
      {children}
    </div>
  );
}
