'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cookie } from 'lucide-react';
import { renovarConsentimento } from '@/lib/consentimento';
import PreferenciasCookies from './PreferenciasCookies';
import { useConsentimento } from './useConsentimento';

/**
 * Banner de consentimento de cookies (LGPD — SPEC §66). Aparece uma única vez,
 * até a primeira escolha (aceitar, recusar ou personalizar); depois a escolha
 * só muda em Minha conta. Não aparece no admin. Recusar tem o mesmo peso
 * visual de aceitar (orientação da ANPD).
 */
export default function BannerCookies() {
  const pathname = usePathname();
  const { pronto, consentimento, escolher } = useConsentimento();
  const [personalizando, setPersonalizando] = useState(false);

  // Quem já escolheu: renova a validade a cada visita (o banner não volta).
  useEffect(() => {
    renovarConsentimento();
  }, []);

  if (!pronto || consentimento || pathname.startsWith('/administrator')) return null;

  const botao = 'w-full sm:w-auto rounded-xl px-4 sm:px-5 py-2.5 text-sm font-semibold transition-colors';

  return (
    <>
      <div
        role="region"
        aria-label="Consentimento de cookies"
        className="fixed inset-x-0 bottom-0 z-[70] p-0 sm:p-4 animate-aviso"
      >
        <div className="mx-auto max-w-4xl rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl shadow-slate-900/15 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:gap-6">
            <div className="flex items-start gap-3 md:flex-1">
              <span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marinho/10 text-marinho">
                <Cookie className="h-5 w-5" />
              </span>
              {/* Celular: texto curto, para o banner não cobrir a primeira tela */}
              <p className="text-sm leading-relaxed text-slate-600">
                <span className="sm:hidden">
                  Usamos cookies para o site funcionar e, com a sua permissão, para medir o uso.
                </span>
                <span className="hidden sm:inline">
                  Usamos cookies necessários para o site funcionar e, com a sua permissão, cookies de medição para
                  entender como o Boatzy é usado e melhorar a plataforma.
                </span>{' '}
                <Link href="/privacy#cookies" className="font-semibold text-marinho hover:underline">
                  Política de Privacidade
                </Link>
              </p>
            </div>
            {/* Recusar e aceitar lado a lado e com o mesmo peso; Personalizar como link (celular) */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-end sm:gap-2 shrink-0">
              <div className="grid grid-cols-2 gap-2 sm:order-2 sm:flex">
                <button
                  type="button"
                  onClick={() => escolher(false, 'banner')}
                  className={`${botao} bg-marinho text-white hover:bg-marinho-escuro`}
                >
                  Recusar opcionais
                </button>
                <button
                  type="button"
                  onClick={() => escolher(true, 'banner')}
                  className={`${botao} bg-marinho text-white hover:bg-marinho-escuro`}
                >
                  Aceitar todos
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPersonalizando(true)}
                className="sm:order-1 rounded-xl px-4 py-1.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-600 underline underline-offset-4 sm:no-underline hover:text-marinho sm:hover:bg-slate-50 transition-colors"
              >
                Personalizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {personalizando && (
        <PreferenciasCookies
          medicaoInicial={false}
          onFechar={() => setPersonalizando(false)}
          onSalvar={(medicao) => {
            setPersonalizando(false);
            escolher(medicao, 'banner');
          }}
        />
      )}
    </>
  );
}
