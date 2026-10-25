'use client';

import { useEffect, useState, type RefObject } from 'react';

type Props = {
  /** Linha de cima: "A partir de" ou a data escolhida. */
  rotulo: string;
  /** Valor já formatado; null = "Consulte o preço". */
  valor: string | null;
  /** "/passeio" ou "/diária". */
  unidade: string;
  /** Texto do botão: "Ver datas" sem data, "Reservar" com data. */
  acao: string;
  onAcao: () => void;
  /** Card de reserva: enquanto ele aparece na tela, a barra some (não duplica o CTA). */
  card: RefObject<HTMLElement | null>;
};

/**
 * Barra fixa no rodapé do celular (< lg) com o preço e o atalho para a reserva — o card de
 * reserva fica no fim da página no celular. Some quando o card ou o rodapé estão visíveis.
 */
export default function BarraReservaMobile({ rotulo, valor, unidade, acao, onAcao, card }: Props) {
  const [cardVisivel, setCardVisivel] = useState(false);
  const [rodapeVisivel, setRodapeVisivel] = useState(false);

  useEffect(() => {
    const alvoCard = card.current;
    const rodape = document.getElementById('footer');
    const observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.target === alvoCard) setCardVisivel(e.isIntersecting);
        else setRodapeVisivel(e.isIntersecting);
      }
    }, { threshold: 0.15 });
    if (alvoCard) observador.observe(alvoCard);
    if (rodape) observador.observe(rodape);
    return () => observador.disconnect();
  }, [card]);

  const oculta = cardVisivel || rodapeVisivel;

  return (
    <div
      aria-hidden={oculta}
      inert={oculta}
      className={`fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-8px_24px_-12px_rgb(14_47_79/0.25)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 ${
        oculta ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="mx-auto flex max-w-xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">{rotulo}</p>
          {valor ? (
            <p className="leading-tight">
              <span className="text-lg font-bold text-marinho">{valor}</span>
              <span className="ml-1 text-xs text-slate-500">{unidade}</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-600">Consulte o preço</p>
          )}
          <p className="text-[11px] text-turquesa-escuro font-medium">Sem cobrança agora</p>
        </div>
        <button
          type="button"
          onClick={onAcao}
          className="shrink-0 rounded-xl bg-marinho px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-marinho/25 transition-colors hover:bg-marinho-escuro active:scale-[0.98]"
        >
          {acao}
        </button>
      </div>
    </div>
  );
}
