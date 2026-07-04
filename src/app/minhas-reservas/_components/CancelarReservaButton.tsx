'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';
import { cancelarReserva } from '../actions';

export default function CancelarReservaButton({ reservaId }: { reservaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function submeter() {
    setErro(null);
    startTransition(async () => {
      const res = await cancelarReserva(reservaId);
      if (!res.ok) {
        setErro(res.error);
      } else {
        setConfirmando(false);
        router.refresh();
      }
    });
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
      >
        <XCircle className="h-4 w-4" />
        Cancelar reserva
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      {erro ? (
        <span className="text-xs font-medium text-red-600">{erro}</span>
      ) : (
        <span className="text-slate-600 font-medium">Cancelar esta reserva?</span>
      )}
      <button
        type="button"
        onClick={submeter}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        Sim, cancelar
      </button>
      <button
        type="button"
        onClick={() => { setConfirmando(false); setErro(null); }}
        disabled={pending}
        className="rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        Voltar
      </button>
    </span>
  );
}
