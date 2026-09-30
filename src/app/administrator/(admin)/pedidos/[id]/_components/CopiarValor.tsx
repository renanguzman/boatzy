'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/** Valor em fonte mono com botão de copiar (ids do Asaas, copia-e-cola do Pix…). */
export default function CopiarValor({ valor, curto = false }: { valor: string; curto?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
      <span className="font-mono text-xs text-slate-700 truncate" title={valor}>
        {curto && valor.length > 24 ? `${valor.slice(0, 12)}…${valor.slice(-8)}` : valor}
      </span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(valor);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
        title="Copiar"
        className="shrink-0 text-slate-400 hover:text-[#0B2447]"
      >
        {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}
