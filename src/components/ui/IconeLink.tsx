'use client';

import { useLinkStatus } from 'next/link';
import Spinner from './Spinner';

/**
 * Usar DENTRO de um <Link>: enquanto a navegação carrega, troca o ícone do botão por um Spinner
 * do mesmo tamanho (sem mexer no layout) e dá retorno imediato do toque, inclusive no celular.
 * Sem filhos (link só de texto), aparece só durante o carregamento, antes do rótulo.
 */
export default function IconeLink({
  children,
  tamanho = 16,
}: {
  children?: React.ReactNode;
  tamanho?: number;
}) {
  const { pending } = useLinkStatus();
  if (pending) return <Spinner tamanho={tamanho} />;
  return <>{children}</>;
}
