'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { ComprovanteAceite } from '../_lib/ficha';

/** Gera o comprovante em PDF no navegador (jsPDF carregado sob demanda). */
export default function BaixarComprovanteButton({ comprovante }: { comprovante: ComprovanteAceite }) {
  const [gerando, setGerando] = useState(false);

  async function baixar() {
    setGerando(true);
    try {
      const { gerarComprovantePdf } = await import('../_lib/comprovante-pdf');
      gerarComprovantePdf(comprovante);
    } finally {
      setGerando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={baixar}
      disabled={gerando}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] text-white text-sm font-semibold transition shadow-md shadow-[#0B2447]/10 disabled:opacity-60"
    >
      {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      Baixar comprovante (PDF)
    </button>
  );
}
