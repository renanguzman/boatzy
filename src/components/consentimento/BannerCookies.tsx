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

  const botao = 'w-full sm:w-auto rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors';

  return (
    <>
      <div
        role="region"
        aria-label="Consentimento de cookies"
        className="fixed inset-x-0 bottom-0 z-[70] p-0 sm:p-4 animate-aviso"
      >
        <div className="mx-auto max-w-4xl rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/15 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="flex items-start gap-3 md:flex-1">
              <span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B3D91]/10 text-[#0B3D91]">
                <Cookie className="h-5 w-5" />
              </span>
              <p className="text-sm leading-relaxed text-slate-600">
                Usamos cookies necessários para o site funcionar e, com a sua permissão, cookies de medição para
                entender como o Boatzy é usado e melhorar a plataforma.{' '}
                <Link href="/privacy#cookies" className="font-semibold text-[#0B3D91] hover:underline">
                  Política de Privacidade
                </Link>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPersonalizando(true)}
                className={`${botao} order-3 sm:order-1 text-slate-600 hover:text-[#0B2447] hover:bg-slate-50`}
              >
                Personalizar
              </button>
              <button
                type="button"
                onClick={() => escolher(false, 'banner')}
                className={`${botao} order-2 bg-[#0B2447] text-white hover:bg-[#0B3D91]`}
              >
                Recusar opcionais
              </button>
              <button
                type="button"
                onClick={() => escolher(true, 'banner')}
                className={`${botao} order-1 sm:order-3 bg-[#0B2447] text-white hover:bg-[#0B3D91]`}
              >
                Aceitar todos
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
