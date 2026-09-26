'use client';

import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';

type Props = {
  titulo: string;
  children: React.ReactNode;
  confirmLabel: string;
  tom: 'perigo' | 'publicar';
  pending: boolean;
  erro?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal de confirmação no padrão do admin (ver modal de desativação em Embarcações). */
export default function ConfirmModal({ titulo, children, confirmLabel, tom, pending, erro, onConfirm, onCancel }: Props) {
  const Icon = tom === 'publicar' ? ShieldCheck : AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => pending || onCancel()} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            tom === 'publicar' ? 'bg-emerald-50' : 'bg-amber-50'
          }`}>
            <Icon className={`w-5 h-5 ${tom === 'publicar' ? 'text-emerald-600' : 'text-amber-500'}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0B2447]">{titulo}</h3>
            <div className="text-sm text-slate-500 mt-1 space-y-2">{children}</div>
          </div>
        </div>

        {erro && (
          <p className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              tom === 'publicar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
