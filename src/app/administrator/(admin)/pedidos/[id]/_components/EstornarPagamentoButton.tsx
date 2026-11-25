'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, Loader2 } from 'lucide-react';
import { estornarPagamento } from '../../actions';

/**
 * Estorno de cartão na Pagar.me (D-S8, SPEC §109): valor vazio = total; com
 * valor = parcial. Exige motivo; vai para a auditoria. O cliente e o gestor
 * recebem o aviso de reembolso quando a Pagar.me confirma.
 */
export default function EstornarPagamentoButton({ pagamentoId, maximo }: { pagamentoId: string; maximo: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!aberto) {
    return (
      <>
        <button type="button" onClick={() => { setAberto(true); setOk(null); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700">
          <Undo2 className="w-3.5 h-3.5" /> Estornar
        </button>
        {ok && <span className="text-xs text-emerald-600">{ok}</span>}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full rounded-xl border border-red-100 bg-red-50/40 p-3">
      <p className="text-xs text-slate-600">
        Estorno no cartão do cliente. Deixe o valor vazio para estornar tudo ({brl(maximo)}).
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={`Valor (máx. ${brl(maximo)})`} inputMode="decimal"
          className="sm:w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-200" />
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do estorno"
          className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-200" />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={pending}
          onClick={() => {
            setErro(null);
            startTransition(async () => {
              const r = await estornarPagamento(pagamentoId, valor, motivo);
              if (!r.ok) setErro(r.error);
              else {
                setAberto(false);
                setOk(r.mensagem ?? 'Estorno enviado.');
                router.refresh();
              }
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white">
          {pending && <Loader2 className="w-3 h-3 animate-spin" />} Confirmar estorno
        </button>
        <button type="button" disabled={pending} onClick={() => { setAberto(false); setErro(null); }}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
          Voltar
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
