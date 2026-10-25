'use client';

import { Printer } from 'lucide-react';

/**
 * Imprime / salva em PDF o comprovante: o resto da página tem `print:hidden`, então a
 * impressão sai só com o comprovante (SPEC §90).
 */
export default function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-marinho hover:bg-slate-50 transition-colors print:hidden"
    >
      <Printer className="h-4 w-4" />
      Imprimir ou salvar PDF
    </button>
  );
}
