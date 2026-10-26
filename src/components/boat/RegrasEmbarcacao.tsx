import { useTranslations } from 'next-intl';
import { Ban, ShieldAlert } from 'lucide-react';

/**
 * Regras a bordo definidas pelo dono (`embarcacao.regras`) — sempre visíveis, logo abaixo de
 * "O que esta embarcação possui", no detalhe do roteiro e na página da embarcação. Card e texto
 * neutros (mesmo visual do bloco vizinho), título em fundo cinza um pouco mais escuro com o escudo no
 * amarelo `destaque`; o vermelho — cor semântica de proibição, fora da paleta de marca — fica só nos
 * ícones de cada regra, para sinalizar sem deixar o bloco com cara de erro.
 */
export default function RegrasEmbarcacao({ regras }: { regras: string[] | null | undefined }) {
  const t = useTranslations('Embarcacao.regras');
  if (!regras || regras.length === 0) return null;

  return (
    <section aria-label={t('titulo')} className="rounded-xl border border-slate-100 bg-white overflow-hidden">
      <h3 className="flex items-center gap-2 border-b border-slate-100 bg-slate-100/70 px-4 py-2.5">
        <ShieldAlert className="h-4 w-4 shrink-0 text-destaque" />
        <span className="text-sm font-semibold text-marinho">{t('titulo')}</span>
        <span className="ml-auto text-[11px] font-medium text-slate-400 tabular-nums">
          {t('contagem', { count: regras.length })}
        </span>
      </h3>
      <ul className="divide-y divide-slate-100 px-4">
        {regras.map((regra) => (
          <li key={regra} className="flex items-start gap-2.5 py-2.5 text-sm leading-snug text-slate-700">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-500" strokeWidth={2} />
            <span>{regra}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
