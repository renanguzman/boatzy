'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, Loader2, X } from 'lucide-react';
import { formatarDataHoraBR } from '@/lib/termos/formato';
import { verificarCadeiaAceites, type VerificacaoCadeia } from '../actions';

/** Botão de auditoria da cadeia de aceites, com o resultado em um painel. */
export default function VerificarCadeiaButton() {
  const [resultado, setResultado] = useState<VerificacaoCadeia | null>(null);
  const [pending, startTransition] = useTransition();

  function verificar() {
    startTransition(async () => setResultado(await verificarCadeiaAceites()));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={verificar}
        disabled={pending}
        className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-[#0B2447] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap disabled:opacity-60"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Verificar integridade
      </button>

      {resultado && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[360px] rounded-2xl border border-slate-100 bg-white shadow-xl p-4">
          <button
            type="button"
            onClick={() => setResultado(null)}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          {!resultado.ok ? (
            <p className="text-sm text-red-600 pr-6">{resultado.error}</p>
          ) : resultado.problemas.length === 0 ? (
            <div className="flex items-start gap-3 pr-6">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Cadeia íntegra</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {resultado.totalAceites} aceite{resultado.totalAceites !== 1 ? 's' : ''} verificado
                  {resultado.totalAceites !== 1 ? 's' : ''}: todos os hashes conferem e nenhum registro foi
                  alterado ou removido.
                </p>
                <p className="text-[11px] text-slate-400 mt-1.5">Verificado em {formatarDataHoraBR(resultado.verificadoEm, { segundos: true })}</p>
              </div>
            </div>
          ) : (
            <div className="pr-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700">
                    {resultado.problemas.length} problema{resultado.problemas.length !== 1 ? 's' : ''} na cadeia
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Houve alteração ou remoção direta no banco. Investigue os registros abaixo.
                  </p>
                </div>
              </div>
              <ul className="mt-3 max-h-48 overflow-y-auto space-y-1.5">
                {resultado.problemas.map((p, i) => (
                  <li key={i} className="text-xs rounded-lg bg-red-50 px-2.5 py-1.5 text-red-800">
                    <Link href={`/administrator/termos/aceites/${p.aceiteId}`} className="font-semibold underline">
                      #{p.sequencia}
                    </Link>{' '}
                    — {p.problema}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
