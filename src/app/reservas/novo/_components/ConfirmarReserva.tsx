'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { criarReserva } from '../actions';

type Props = {
  roteiroId: string;
  data: string;
  flex: number;
  pessoas: number;
  adicionaisIds: string[];
};

export default function ConfirmarReserva({ roteiroId, data, flex, pessoas, adicionaisIds }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await criarReserva({ roteiroId, data, flex, pessoas, adicionaisIds });
    setLoading(false);
    if (result.ok) {
      setEnviada(true);
    } else {
      setError(result.error);
    }
  }

  if (enviada) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-emerald-800">Solicitação enviada!</h2>
        <p className="text-sm text-emerald-700 mt-1">
          Sua reserva está <strong>pendente</strong>. O gestor vai analisar e responder em breve.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/buscar"
            className="px-5 py-2.5 bg-[#0B3D91] hover:bg-[#0B2447] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Explorar outros roteiros
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <p className="mb-3 text-sm font-medium text-red-600 text-center" role="alert">
          {error}
        </p>
      )}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full bg-[#0B3D91] hover:bg-[#092E6E] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          'Confirmar solicitação'
        )}
      </button>
      <p className="mt-2 text-xs text-slate-400 text-center">
        Você não será cobrado agora. A reserva só é efetivada após a confirmação do gestor.
      </p>
    </div>
  );
}
