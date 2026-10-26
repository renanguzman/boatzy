'use client';

import type { ReactNode } from 'react';
import { abrirAcesso, type AbaAcesso } from '../_lib/acesso';

/** Botão de CTA da landing: rola até o formulário de acesso, já na aba pedida. */
export default function IrParaAcesso({
  aba,
  className,
  children,
}: {
  aba: AbaAcesso;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={() => abrirAcesso(aba)} className={className}>
      {children}
    </button>
  );
}
