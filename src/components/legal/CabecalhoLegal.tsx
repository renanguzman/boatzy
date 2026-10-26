import { getLocale, getTranslations } from 'next-intl/server';
import { getFormatos } from '@/i18n/formatos-servidor';

/**
 * Topo das páginas legais (/terms, /privacy): título, data da última atualização e, fora do
 * pt-BR, o aviso de tradução de conveniência — vale a versão em português (SPEC §94.11).
 */
export default async function CabecalhoLegal({ titulo, atualizadoEm }: { titulo: string; atualizadoEm: string }) {
  const [t, f, idioma] = await Promise.all([getTranslations('Legal'), getFormatos(), getLocale()]);
  return (
    <>
      <section className="bg-marinho text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{titulo}</h1>
          <p className="mt-3 text-sm text-slate-300">{t('atualizacao', { data: f.data(atualizadoEm) })}</p>
        </div>
      </section>
      {idioma !== 'pt-BR' && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-8">
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <p>{t.rich('avisoTraducao', { b: (texto) => <strong>{texto}</strong> })}</p>
          </div>
        </div>
      )}
    </>
  );
}
