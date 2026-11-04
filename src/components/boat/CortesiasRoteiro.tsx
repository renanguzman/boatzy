import { useTranslations } from 'next-intl';
import { Check, Gift } from 'lucide-react';

/**
 * Cortesias do passeio definidas pelo gestor (`roteiro.cortesias`) — no detalhe do roteiro, entre as
 * especificações e os opcionais ("Turbine seu passeio"). Mesmo desenho do bloco de regras a bordo,
 * porém em verde suave com check (algo que o cliente ganha, não uma restrição). Some sem cortesias.
 */
export default function CortesiasRoteiro({ cortesias }: { cortesias: string[] | null | undefined }) {
  const t = useTranslations('Roteiro.cortesias');
  if (!cortesias || cortesias.length === 0) return null;

  return (
    <section aria-label={t('titulo')} className="mb-8 rounded-xl border border-emerald-100 bg-white overflow-hidden">
      <h3 className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/70 px-4 py-2.5">
        <Gift className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="text-sm font-semibold text-marinho">{t('titulo')}</span>
        <span className="ml-auto text-[11px] font-medium text-emerald-700/70 tabular-nums">
          {t('contagem', { count: cortesias.length })}
        </span>
      </h3>
      <p className="px-4 pt-2.5 text-xs text-slate-500">{t('descricao')}</p>
      <ul className="grid gap-x-6 px-4 pb-3 pt-1 sm:grid-cols-2">
        {cortesias.map((cortesia) => (
          <li key={cortesia} className="flex items-start gap-2.5 py-1.5 text-sm leading-snug text-slate-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
            <span>{cortesia}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
