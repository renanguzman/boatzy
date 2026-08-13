'use client';

import { useState } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { salvarTaxaGestor, removerTaxaGestor } from '../actions';
import type { AdminGestorTaxaItem } from './AdminTaxasGestoresGrid';

type Props = {
  gestor: AdminGestorTaxaItem;
  onClose: () => void;
  onSaved: () => void;
};

export default function TaxaGestorModal({ gestor, onClose, onSaved }: Props) {
  const t = gestor.taxaEspecifica;
  const [taxaPercent, setTaxaPercent] = useState(t ? String(t.taxaPercent) : '');
  const [ativo, setAtivo] = useState(t?.ativo ?? true);
  const [dataValidade, setDataValidade] = useState(t?.dataValidade ?? '');
  const [observacao, setObservacao] = useState(t?.observacao ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (pending) return;
    onClose();
  }

  async function handleSalvar() {
    setPending(true);
    setError(null);
    const result = await salvarTaxaGestor({
      userId: gestor.id,
      taxaPercent,
      ativo,
      dataValidade,
      observacao,
    });
    setPending(false);
    if (result.ok) {
      onSaved();
    } else {
      setError(result.error ?? 'Erro ao salvar taxa específica.');
    }
  }

  async function handleRemover() {
    if (!confirm(`Remover a taxa específica de ${gestor.name}? A taxa geral volta a valer para este gestor.`)) return;
    setPending(true);
    setError(null);
    const result = await removerTaxaGestor(gestor.id);
    setPending(false);
    if (result.ok) {
      onSaved();
    } else {
      setError(result.error ?? 'Erro ao remover taxa específica.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#0B2447]">Taxa específica</h3>
            <p className="text-sm text-slate-500 mt-0.5">{gestor.name} — {gestor.email}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Taxa (%)
            </label>
            <div className="relative w-32">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={taxaPercent}
                onChange={(e) => setTaxaPercent(e.target.value)}
                placeholder="12,00"
                className="w-full pl-3 pr-7 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Pode ser maior ou menor que a taxa geral vigente.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ativa</label>
            <button
              type="button"
              role="switch"
              aria-checked={ativo}
              onClick={() => setAtivo((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                ativo ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  ativo ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Válida até <span className="normal-case font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="date"
              value={dataValidade}
              onChange={(e) => setDataValidade(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition"
            />
            <p className="mt-1 text-[11px] text-slate-400">Em branco = sem expiração.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Observação <span className="normal-case font-normal text-slate-400">(opcional, uso interno)</span>
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: acordo comercial, período de lançamento…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2447]/20 focus:border-[#0B2447]/40 transition resize-none"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {t ? (
            <button
              type="button"
              onClick={handleRemover}
              disabled={pending}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover taxa específica
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={pending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2447] hover:bg-[#0B3D91] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
