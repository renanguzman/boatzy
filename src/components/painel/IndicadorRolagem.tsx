'use client';

import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';

type Props = {
  /** `id` da seção para onde a tela rola ao clicar. */
  alvoId: string;
  /** Só aparece quando a etapa que contém o alvo está aberta. */
  ativo: boolean;
  rotulo: string;
};

/**
 * Botão flutuante com seta que avisa que há algo importante mais abaixo na
 * página (o calendário de preços) e leva até lá com rolagem suave. Some quando
 * o alvo já está visível — ou já ficou para trás — e volta se o gestor subir.
 */
export default function IndicadorRolagem({ alvoId, ativo, rotulo }: Props) {
  const [alvoAbaixo, setAlvoAbaixo] = useState(false);

  useEffect(() => {
    const alvo = ativo ? document.getElementById(alvoId) : null;
    if (!alvo) return;

    // O alvo conta como "à vista" quando seu topo entra nos 75% superiores da tela.
    const observer = new IntersectionObserver(
      ([entry]) => setAlvoAbaixo(!entry.isIntersecting && entry.boundingClientRect.top > 0),
      { rootMargin: '0px 0px -25% 0px' },
    );
    observer.observe(alvo);
    return () => observer.disconnect();
  }, [alvoId, ativo]);

  function rolar() {
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(alvoId)?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
  }

  if (!ativo || !alvoAbaixo) return null;

  return (
    <button type="button" onClick={rolar}
      className="fixed z-30 right-4 md:right-8 bottom-28 flex items-center gap-2.5 rounded-full bg-[#0B2447] pl-4 pr-2 py-2 text-white shadow-xl shadow-[#0B2447]/30 hover:bg-[#0B3D91] transition-colors">
      <span className="text-xs font-semibold">{rotulo}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <ArrowDown className="h-4 w-4 motion-safe:animate-bounce" />
      </span>
    </button>
  );
}
