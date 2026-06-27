'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2 } from 'lucide-react';
import { confirmarReserva, recusarReserva } from '../../actions';

type Props = {
  reservaId: string;
  status: 'pendente' | 'confirmada' | 'recusada';
};

export default function ReservaAcoes({ reservaId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acao, setAcao] = useState<'confirmar' | 'recusar' | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (status !== 'pendente') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <p className="text-sm text-slate-500">
          Esta reserva já foi {status === 'confirmada' ? 'confirmada' : 'cancelada'}. Não há ações pendentes.
        </p>
      </section>
    );
  }

  function submeter() {
    if (!acao) return;
    setErro(null);
    startTransition(async () => {
      const fn = acao === 'confirmar' ? confirmarReserva : recusarReserva;
      const res = await fn(reservaId, observacao);
      if (!res.ok) {
        setErro(res.error ?? 'Erro ao processar.');
      } else {
        setAcao(null);
        setObservacao('');
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-bold text-[#0B2447] mb-4">Responder solicitação</h2>

      {erro && <p className="mb-3 text-xs font-medium text-red-600">{erro}</p>}

      {acao ? (
        <div className="space-y-3">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder={
              acao === 'confirmar'
                ? 'Observação ao cliente (opcional) — ponto de encontro, instruções…'
                : 'Motivo do cancelamento (opcional) — será retornado ao cliente.'
            }
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/30"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submeter}
              disabled={pending}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                acao === 'confirmar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : acao === 'confirmar' ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {acao === 'confirmar' ? 'Confirmar' : 'Cancelar reserva'}
            </button>
            <button
              onClick={() => { setAcao(null); setErro(null); }}
              disabled={pending}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => setAcao('confirmar')}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Check className="h-4 w-4" />
            Confirmar reserva
          </button>
          <button
            onClick={() => setAcao('recusar')}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 text-sm font-semibold"
          >
            <X className="h-4 w-4" />
            Cancelar reserva
          </button>
        </div>
      )}
    </section>
  );
}
