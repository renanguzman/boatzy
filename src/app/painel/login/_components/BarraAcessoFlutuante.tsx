'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { abrirAcesso, ID_FORMULARIO_ACESSO, type AbaAcesso } from '../_lib/acesso';

/**
 * CTA fixo que aparece depois que o formulário do topo sai da tela (rolou para baixo) e some
 * quando ele volta, ou quando a chamada final (`#chamada-final`, que já tem os botões) aparece.
 * Celular: barra na base, largura toda. Computador: pílula no canto inferior direito.
 */
export default function BarraAcessoFlutuante({ aba, rotulo }: { aba: AbaAcesso; rotulo: string }) {
  const [formAcima, setFormAcima] = useState(false);
  const [finalVisivel, setFinalVisivel] = useState(false);

  useEffect(() => {
    const form = document.getElementById(ID_FORMULARIO_ACESSO);
    const final = document.getElementById('chamada-final');
    if (!form || !('IntersectionObserver' in window)) return;

    const obsForm = new IntersectionObserver(([e]) => {
      setFormAcima(!e.isIntersecting && e.boundingClientRect.top < 0);
    });
    obsForm.observe(form);

    const obsFinal = new IntersectionObserver(([e]) => setFinalVisivel(e.isIntersecting));
    if (final) obsFinal.observe(final);

    return () => {
      obsForm.disconnect();
      obsFinal.disconnect();
    };
  }, []);

  const visivel = formAcima && !finalVisivel;

  return (
    <div
      aria-hidden={!visivel}
      className={`fixed inset-x-0 bottom-0 z-40 p-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:p-0 transition-all duration-300 motion-reduce:transition-none ${
        visivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      <button
        type="button"
        tabIndex={visivel ? 0 : -1}
        onClick={() => abrirAcesso(aba)}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-marinho px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-marinho/30 ring-1 ring-white/10 transition-colors hover:bg-marinho-escuro sm:w-auto"
      >
        {rotulo}
        <ArrowUp className="h-4 w-4 text-turquesa" />
      </button>
    </div>
  );
}
