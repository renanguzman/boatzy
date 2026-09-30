'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Loader2 } from 'lucide-react';
import { cancelarCobranca } from '../../actions';

/** Remove no Asaas uma cobrança ainda não paga (ex.: tentativa duplicada). Exige motivo; vai para a auditoria. */
export default function CancelarCobrancaButton({ pagamentoId }: { pagamentoId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700">
        <Ban className="w-3.5 h-3.5" /> Cancelar cobrança
      </button>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full">
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do cancelamento"
        className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-200" />
      <div className="flex gap-2">
        <button type="button" disabled={pending}
          onClick={() => {
            setErro(null);
            startTransition(async () => {
              const r = await cancelarCobranca(pagamentoId, motivo);
              if (!r.ok) setErro(r.error);
              else {
                setAberto(false);
                router.refresh();
              }
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white">
          {pending && <Loader2 className="w-3 h-3 animate-spin" />} Confirmar
        </button>
        <button type="button" disabled={pending} onClick={() => { setAberto(false); setErro(null); }}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
          Voltar
        </button>
      </div>
      {erro && <p className="text-xs text-red-600 w-full">{erro}</p>}
    </div>
  );
}
