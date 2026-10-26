'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

/** Erro inesperado em qualquer página (SPEC §94.11), no idioma do site. */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations('Erros.inesperado');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-[70vh] bg-areia flex items-center">
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-marinho">{t('titulo')}</h1>
        <p className="mt-3 text-slate-500">{t('texto')}</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="px-5 py-2.5 rounded-xl bg-marinho hover:bg-marinho-escuro text-white text-sm font-semibold transition-colors"
          >
            {t('tentar')}
          </button>
          <Link href="/" className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-marinho text-sm font-semibold transition-colors">
            {t('inicio')}
          </Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-slate-400 font-mono">{t('codigo', { codigo: error.digest })}</p>}
      </div>
    </main>
  );
}
