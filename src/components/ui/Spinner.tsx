/**
 * Indicador de carregamento do Boatzy: anel fino que herda a cor do texto (currentColor),
 * então funciona em botões marinho (branco), amarelo (marinho) ou claros sem configuração.
 * Com "reduzir movimento" no sistema, o giro vira um pulso suave (ver globals.css).
 */
type Props = {
  /** Lado em px (padrão 16 — cabe em botões de texto sm/base). */
  tamanho?: number;
  className?: string;
};

export default function Spinner({ tamanho = 16, className = '' }: Props) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`boatzy-spinner shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
