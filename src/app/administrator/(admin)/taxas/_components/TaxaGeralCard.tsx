'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { atualizarTaxaGeral } from '../actions';
import type { TaxaGeral } from '@/lib/taxas';

type Props = {
  taxaAtual: TaxaGeral | null;
};

export default function TaxaGeralCard({ taxaAtual }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(taxaAtual ? String(taxaAtual.taxaPercent) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setValor(taxaAtual ? String(taxaAtual.taxaPercent) : '');
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await atualizarTaxaGeral(valor);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error ?? 'Erro ao salvar taxa geral.');
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase mb-2">Taxa geral</p>

      {editing ? (
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
              className="w-28 pl-3 pr-7 py-2 rounded-xl border border-slate-200 text-lg font-bold text-[#0B2447] focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            title="Salvar"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            title="Cancelar"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-3xl font-bold text-[#0B2447] leading-none">
            {taxaAtual ? `${taxaAtual.taxaPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0B3D91] hover:text-[#0B2447] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

      <p className="mt-3 text-xs text-slate-400 max-w-md">
        Percentual cobrado sobre o valor do roteiro/embarcação em toda reserva, exceto para
        gestores com taxa específica definida abaixo.
      </p>
    </div>
  );
}
