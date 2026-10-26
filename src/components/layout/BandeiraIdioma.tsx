import { useId } from 'react';
import type { Idioma } from '@/i18n/config';

type Props = {
  idioma: Idioma;
  /** Diâmetro em px (padrão 20). */
  tamanho?: number;
  className?: string;
};

/**
 * Bandeira redonda do idioma (Brasil, EUA, Espanha), em SVG próprio — emoji
 * de bandeira não renderiza no Windows (ver `src/lib/countries.ts`). Versões
 * simplificadas, legíveis a 16–24 px. Decorativa: o nome do idioma vai no texto
 * ou no aria-label de quem usa.
 */
export default function BandeiraIdioma({ idioma, tamanho = 20, className = '' }: Props) {
  const clipId = useId();
  return (
    <svg
      viewBox="0 0 20 20"
      width={tamanho}
      height={tamanho}
      aria-hidden
      className={`shrink-0 rounded-full ring-1 ring-black/10 ${className}`}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="10" cy="10" r="10" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{DESENHOS[idioma]}</g>
    </svg>
  );
}

// Listras dos EUA: 13 de 20/13 px, vermelhas nas posições pares.
const ALTURA_LISTRA = 20 / 13;

const DESENHOS: Record<Idioma, React.ReactNode> = {
  'pt-BR': (
    <>
      <rect width="20" height="20" fill="#009C3B" />
      <polygon points="10,3.2 18.6,10 10,16.8 1.4,10" fill="#FFDF00" />
      <circle cx="10" cy="10" r="4.1" fill="#002776" />
      <path d="M6.1 9.1 Q10 7.7 13.9 10.5" stroke="#fff" strokeWidth="0.9" fill="none" />
    </>
  ),
  'en-US': (
    <>
      <rect width="20" height="20" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2 * ALTURA_LISTRA} width="20" height={ALTURA_LISTRA} fill="#B22234" />
      ))}
      <rect width="10" height={ALTURA_LISTRA * 7} fill="#3C3B6E" />
      {[2.5, 5, 7.5].flatMap((cx) =>
        [2.4, 5.4, 8.4].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.55" fill="#fff" />),
      )}
    </>
  ),
  es: (
    <>
      <rect width="20" height="20" fill="#AA151B" />
      <rect y="5" width="20" height="10" fill="#F1BF00" />
    </>
  ),
};
