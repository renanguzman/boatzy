import type { ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { CalendarCheck, Ship, Star } from 'lucide-react';
import { useFormatos } from '@/i18n/formatos';
import type { OperadorPublico } from '@/lib/operador-tipos';

/**
 * Topo da página pública do operador (SPEC §99): retrato grande, "Olá, eu sou {nome}",
 * reputação (média das avaliações aprovadas ou "Novo"), tempo de casa e a biografia completa.
 * `acao` = botão de conversar (ou atalho de edição, para o dono).
 */
export default function OperadorHero({ operador, acao }: { operador: OperadorPublico; acao?: ReactNode }) {
  const t = useTranslations('Operador');
  const tPagina = useTranslations('Operador.pagina');
  const f = useFormatos();

  const selo = 'inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-marinho ring-1 ring-slate-200';

  return (
    <section className="relative overflow-hidden bg-areia">
      <svg aria-hidden viewBox="0 0 480 120" fill="none" className="pointer-events-none absolute -right-24 top-6 h-32 w-[34rem] text-turquesa/20">
        <path d="M0 70c40-40 80-40 120 0s80 40 120 0 80-40 120 0 80 40 120 0" stroke="currentColor" strokeWidth="2" />
        <path d="M0 96c40-40 80-40 120 0s80 40 120 0 80-40 120 0 80 40 120 0" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      </svg>

      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-12 md:py-14 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
        <div className="relative mx-auto w-full max-w-[16rem] self-start pb-3 pr-3 md:mx-0 md:max-w-none">
          <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl border-2 border-turquesa/30" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-slate-200 shadow-xl shadow-marinho/10">
            <Image
              src={operador.fotoUrl}
              alt={t('fotoAlt', { nome: operador.nome })}
              fill
              priority
              sizes="(min-width: 1024px) 288px, (min-width: 768px) 256px, 256px"
              className="object-cover object-[50%_22%]"
              unoptimized
            />
          </div>
        </div>

        <div className="min-w-0 max-w-3xl self-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-turquesa-escuro">{t('membroDesde', { ano: operador.desdeAno })}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-marinho sm:text-4xl">
            {tPagina('ola', { nome: operador.primeiroNome })}
          </h1>
          {operador.headline && <p className="mt-2 text-lg font-medium italic leading-snug text-slate-600">{operador.headline}</p>}

          <ul className="mt-4 flex flex-wrap gap-2">
            <li className={selo}>
              {operador.media !== null ? (
                <>
                  <Star className="h-3.5 w-3.5 fill-destaque text-destaque" aria-hidden />
                  <span className="tabular-nums">{f.numero(operador.media, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                  <span className="font-normal text-slate-500">{t('avaliacoes', { count: operador.totalAvaliacoes })}</span>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-turquesa/10 px-2 py-px text-turquesa-escuro">{t('novo')}</span>
                  <span className="font-normal text-slate-500">{t('semAvaliacoes')}</span>
                </>
              )}
            </li>
            {operador.experiencias > 0 && (
              <li className={selo}>
                <Ship className="h-3.5 w-3.5 text-turquesa-escuro" aria-hidden />
                <span className="tabular-nums">{f.numero(operador.experiencias)}</span>
                <span className="font-normal text-slate-500">{operador.experiencias === 1 ? t('metricaExperiencia') : t('metricaExperiencias')}</span>
              </li>
            )}
            {operador.passeiosRealizados > 0 && (
              <li className={selo}>
                <CalendarCheck className="h-3.5 w-3.5 text-turquesa-escuro" aria-hidden />
                <span className="tabular-nums">{f.numero(operador.passeiosRealizados)}</span>
                <span className="font-normal text-slate-500">{operador.passeiosRealizados === 1 ? t('metricaPasseio') : t('metricaPasseios')}</span>
              </li>
            )}
          </ul>

          <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-slate-600">{operador.bio}</p>

          {acao && <div className="mt-7">{acao}</div>}
        </div>
      </div>
    </section>
  );
}
