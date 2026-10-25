'use client';

import { AlertTriangle } from 'lucide-react';
import { CAMPO_SENSIVEL_LABEL } from '@/lib/publicacao/config';

/**
 * Confirmação antes de salvar uma edição sensível de um registro Ativo:
 * o cadastro sai do site e volta para a análise da equipe Boatzy.
 */
export default function ConfirmarNovaAnaliseModal({ campos, onConfirmar, onCancelar }: {
  /** Chaves de `CAMPO_SENSIVEL_LABEL` alteradas no formulário. */
  campos: string[];
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancelar} />
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-marinho">Enviar para nova análise?</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Estas alterações precisam ser aprovadas pela equipe Boatzy. Ao salvar, o cadastro
              <strong> sai do site</strong> até a aprovação.
            </p>
          </div>
        </div>
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="mb-2 text-xs font-semibold text-amber-800">Campos alterados:</p>
          <ul className="flex flex-wrap gap-1.5">
            {campos.map(c => (
              <li key={c} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                {CAMPO_SENSIVEL_LABEL[c] ?? c}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancelar}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
            Voltar
          </button>
          <button type="button" onClick={onConfirmar}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition">
            Salvar e enviar para análise
          </button>
        </div>
      </div>
    </div>
  );
}
