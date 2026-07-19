'use client';

import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/validators';

type PasswordRequirementsProps = {
  password: string;
};

/**
 * Lista os requisitos de senha e marca cada um com um check à medida que o
 * usuário digita. Enquanto o campo está vazio, mostra os requisitos em cinza
 * (estado neutro); ao digitar, cada regra vira verde (ok) ou permanece pendente.
 */
export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const touched = password.length > 0;

  return (
    <ul className="mt-2 grid grid-cols-1 gap-1.5" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className="flex items-center gap-2 text-xs">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
                ok
                  ? 'bg-green-100 text-green-600'
                  : touched
                    ? 'bg-red-50 text-red-400'
                    : 'bg-slate-100 text-slate-300'
              }`}
            >
              {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <span className={ok ? 'text-green-700' : touched ? 'text-slate-600' : 'text-slate-400'}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
