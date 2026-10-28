'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins, Loader2, Check } from 'lucide-react';
import { salvarCobrancaAvulsa } from '../actions';

type Props = {
  cobrarComissao: boolean;
  prazoPadraoHoras: number;
  prazoMaxDias: number;
  diasAposPasseio: number;
};

const inputCls =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20';

/** Regras da cobrança avulsa que o gestor emite depois da reserva (SPEC §34.16). */
export default function CobrancaAvulsaCard({ cobrarComissao, prazoPadraoHoras, prazoMaxDias, diasAposPasseio }: Props) {
  const router = useRouter();
  const [comissao, setComissao] = useState(cobrarComissao);
  const [padrao, setPadrao] = useState(String(prazoPadraoHoras));
  const [maximo, setMaximo] = useState(String(prazoMaxDias));
  const [janela, setJanela] = useState(String(diasAposPasseio));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const alterado =
    comissao !== cobrarComissao ||
    padrao !== String(prazoPadraoHoras) ||
    maximo !== String(prazoMaxDias) ||
    janela !== String(diasAposPasseio);

  async function handleSalvar() {
    setSalvando(true);
    setMensagem(null);
    const r = await salvarCobrancaAvulsa({ cobrarComissao: comissao, prazoPadraoHoras: padrao, prazoMaxDias: maximo, diasAposPasseio: janela });
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
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Cobrança avulsa do gestor</p>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Produtos, serviços ou taxas que o gestor cobra à parte, depois da reserva confirmada.
          </p>
        </div>
        <HandCoins className="w-4 h-4 text-slate-300" />
      </div>

      <label className="flex items-start justify-between gap-4 mb-5 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 cursor-pointer">
        <span>
          <span className="block text-sm font-semibold text-slate-700">Cobrar taxa de serviço</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">
            {comissao
              ? 'A taxa da reserva é somada ao valor do gestor e paga pelo cliente, como no pedido da reserva.'
              : 'Desligado: o cliente paga só o valor do gestor (o Boatzy absorve a tarifa do Asaas).'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={comissao}
          onChange={(e) => setComissao(e.target.checked)}
          disabled={salvando}
          className="mt-1 h-4 w-4 accent-emerald-600"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Prazo padrão (horas)</span>
          <input type="number" min={1} step={1} value={padrao} onChange={(e) => setPadrao(e.target.value)} disabled={salvando} className={inputCls} />
          <span className="block text-[11px] text-slate-400 mt-1">Sugerido ao gestor ao emitir.</span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Prazo máximo (dias)</span>
          <input type="number" min={1} max={60} step={1} value={maximo} onChange={(e) => setMaximo(e.target.value)} disabled={salvando} className={inputCls} />
          <span className="block text-[11px] text-slate-400 mt-1">Também limita a prorrogação pelo admin.</span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Emitir até (dias após o passeio)</span>
          <input type="number" min={0} max={365} step={1} value={janela} onChange={(e) => setJanela(e.target.value)} disabled={salvando} className={inputCls} />
          <span className="block text-[11px] text-slate-400 mt-1">Reserva confirmada ou concluída.</span>
        </label>
      </div>

      <p className="text-[11px] text-slate-400 mt-4">
        As formas de pagamento e o parcelamento máximo seguem o card “Formas de pagamento”: o gestor só escolhe dentro deles.
      </p>

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
