'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Loader2, Check } from 'lucide-react';
import { salvarPrazosFinanceiro } from '../actions';

type Props = {
  exigirPagamento: boolean;
  horasPrazoPagamento: number;
  horasRepasseAposPasseio: number;
};

const inputCls =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20';

export default function PrazosCard({ exigirPagamento, horasPrazoPagamento, horasRepasseAposPasseio }: Props) {
  const router = useRouter();
  const [exigir, setExigir] = useState(exigirPagamento);
  const [prazo, setPrazo] = useState(String(horasPrazoPagamento));
  const [repasse, setRepasse] = useState(String(horasRepasseAposPasseio));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const alterado =
    exigir !== exigirPagamento || prazo !== String(horasPrazoPagamento) || repasse !== String(horasRepasseAposPasseio);

  async function handleSalvar() {
    setSalvando(true);
    setMensagem(null);
    const r = await salvarPrazosFinanceiro({ exigirPagamento: exigir, horasPrazoPagamento: prazo, horasRepasseAposPasseio: repasse });
    setSalvando(false);
    if (r.ok) {
      setMensagem({ ok: true, texto: 'Salvo.' });
      router.refresh();
    } else {
      setMensagem({ ok: false, texto: r.error });
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Cobrança e prazos</p>
          <p className="text-sm text-slate-500 mt-1 mb-5">Pagamento no aceite, janela para pagar e liberação do repasse.</p>
        </div>
        <Clock className="w-4 h-4 text-slate-300" />
      </div>

      <label className="flex items-start justify-between gap-4 mb-5 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 cursor-pointer">
        <span>
          <span className="block text-sm font-semibold text-slate-700">Exigir pagamento no aceite</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">
            {exigir
              ? 'Ao aceitar, o gestor envia a cobrança e a reserva só é confirmada depois do pagamento pelo Boatzy.'
              : 'Desligado: o aceite do gestor confirma a reserva direto, sem pagamento pela plataforma.'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={exigir}
          onChange={(e) => setExigir(e.target.checked)}
          disabled={salvando}
          className="mt-1 h-4 w-4 accent-emerald-600"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Prazo para pagar (horas)</span>
          <input type="number" min={1} max={168} step={1} value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={salvando} className={inputCls} />
          <span className="block text-[11px] text-slate-400 mt-1">Contado do aceite do gestor. Sem pagamento, o pedido expira e a data é liberada.</span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Repasse após o passeio (horas)</span>
          <input type="number" min={0} max={720} step={1} value={repasse} onChange={(e) => setRepasse(e.target.value)} disabled={salvando} className={inputCls} />
          <span className="block text-[11px] text-slate-400 mt-1">Contado do fim do passeio, e só depois que o gestor confirmar que ele foi realizado.</span>
        </label>
      </div>

      {(alterado || mensagem) && (
        <div className="flex items-center gap-3 mt-5">
          {alterado && (
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B2447] text-white text-sm font-semibold hover:bg-[#0B3D91] disabled:opacity-50 transition-colors"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar
            </button>
          )}
          {mensagem && <span className={`text-sm ${mensagem.ok ? 'text-emerald-600' : 'text-red-600'}`}>{mensagem.texto}</span>}
        </div>
      )}
    </div>
  );
}
