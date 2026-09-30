'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, QrCode, Loader2, Check } from 'lucide-react';
import type { FormaPagamentoCodigo } from '@/types/supabase';
import { salvarFormaPagamento } from '../actions';

type Forma = {
  codigo: FormaPagamentoCodigo;
  nome: string;
  ativo: boolean;
  parcelas_max: number;
  valor_minimo_parcela: number | null;
};

const ICONE: Record<FormaPagamentoCodigo, React.ElementType> = { pix: QrCode, cartao_credito: CreditCard };

function Toggle({ ativo, onChange, disabled }: { ativo: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={() => onChange(!ativo)}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${ativo ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-4' : ''}`} />
    </button>
  );
}

function LinhaForma({ forma }: { forma: Forma }) {
  const router = useRouter();
  const ehCartao = forma.codigo === 'cartao_credito';
  const [ativo, setAtivo] = useState(forma.ativo);
  const [parcelas, setParcelas] = useState(forma.parcelas_max);
  const [minimo, setMinimo] = useState(forma.valor_minimo_parcela != null ? String(forma.valor_minimo_parcela) : '');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const alterado =
    ativo !== forma.ativo ||
    parcelas !== forma.parcelas_max ||
    minimo !== (forma.valor_minimo_parcela != null ? String(forma.valor_minimo_parcela) : '');

  async function handleSalvar() {
    setSalvando(true);
    setMensagem(null);
    const r = await salvarFormaPagamento({ codigo: forma.codigo, ativo, parcelasMax: parcelas, valorMinimoParcela: minimo });
    setSalvando(false);
    if (r.ok) {
      setMensagem({ ok: true, texto: 'Salvo.' });
      router.refresh();
    } else {
      setMensagem({ ok: false, texto: r.error });
    }
  }

  const Icon = ICONE[forma.codigo] ?? CreditCard;

  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#0B2447]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{forma.nome}</p>
            <p className="text-xs text-slate-400">{ativo ? 'Disponível no pagamento' : 'Oculta no pagamento'}</p>
          </div>
        </div>
        <Toggle ativo={ativo} onChange={setAtivo} disabled={salvando} />
      </div>

      {ehCartao && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 ml-12">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Parcelamento máximo</span>
            <select
              value={parcelas}
              onChange={(e) => setParcelas(Number(e.target.value))}
              disabled={salvando}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === 1 ? '1x (só à vista)' : `até ${n}x`}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Valor mínimo por parcela (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Sem mínimo"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              disabled={salvando || parcelas === 1}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>
          <p className="sm:col-span-2 text-[11px] text-slate-400">
            Vale para todos os pedidos gerados a partir da alteração. No parcelado, o Asaas credita uma parcela
            por mês e a tarifa é maior — absorvida pelo Boatzy.
          </p>
        </div>
      )}

      {(alterado || mensagem) && (
        <div className="flex items-center gap-3 mt-4 ml-12">
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
          {mensagem && (
            <span className={`text-sm ${mensagem.ok ? 'text-emerald-600' : 'text-red-600'}`}>{mensagem.texto}</span>
          )}
        </div>
      )}
    </li>
  );
}

export default function FormasPagamentoCard({ formas }: { formas: Forma[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Formas de pagamento</p>
      <p className="text-sm text-slate-500 mt-1 mb-5">Quais formas o cliente pode usar e o parcelamento do cartão.</p>
      <ul className="divide-y divide-slate-100">
        {formas.map((f) => (
          <LinhaForma key={`${f.codigo}-${f.ativo}-${f.parcelas_max}-${f.valor_minimo_parcela}`} forma={f} />
        ))}
      </ul>
    </div>
  );
}
