'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { formatarDataHora } from '@/lib/datas';
import PreferenciasCookies from '@/components/consentimento/PreferenciasCookies';
import { useConsentimento } from '@/components/consentimento/useConsentimento';

/** Seção "Privacidade e cookies" de Minha conta — único lugar para rever a escolha do banner (SPEC §66). */
export default function PrivacidadeCookies() {
  const { pronto, consentimento, escolher } = useConsentimento();
  const [aberto, setAberto] = useState(false);

  const medicao = consentimento?.medicao ?? false;

  return (
    <div id="privacidade" className="scroll-mt-32 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2">
        <Cookie className="h-5 w-5 text-marinho" />
        <h3 className="text-base font-bold text-marinho">Privacidade e cookies</h3>
      </div>
      <p className="mt-0.5 text-sm text-slate-500">
        Veja e altere o que o Boatzy pode usar neste navegador.{' '}
        <Link href="/privacy#cookies" className="font-semibold text-marinho hover:underline">
          Política de Privacidade
        </Link>
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5 text-sm">
          <p className="text-slate-700">
            <span className="font-medium">Necessários:</span> <span className="text-slate-500">sempre ativos</span>
          </p>
          <p className="text-slate-700">
            <span className="font-medium">Medição (Google Analytics):</span>{' '}
            {pronto && (
              <span className={medicao ? 'font-semibold text-turquesa-escuro' : 'text-slate-500'}>
                {medicao ? 'permitida' : 'não permitida'}
              </span>
            )}
          </p>
          {consentimento?.em && (
            <p className="text-xs text-slate-400">Última escolha em {formatarDataHora(consentimento.em)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="shrink-0 rounded-xl border border-marinho px-5 py-2.5 text-sm font-semibold text-marinho transition-colors hover:bg-marinho/5"
        >
          Gerenciar cookies
        </button>
      </div>

      {aberto && (
        <PreferenciasCookies
          medicaoInicial={medicao}
          onFechar={() => setAberto(false)}
          onSalvar={(m) => {
            setAberto(false);
            escolher(m, 'minha_conta');
          }}
        />
      )}
    </div>
  );
}
