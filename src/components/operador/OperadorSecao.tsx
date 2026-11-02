'use client';

import { useId, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Star } from 'lucide-react';
import { useFormatos } from '@/i18n/formatos';
import type { OperadorPublico } from '@/lib/operador-tipos';

/** Acima disto a biografia vem recolhida, com "Ler mais". */
const LIMITE_RECOLHIDA = 300;

/**
 * Seção "Quem vai receber você" (SPEC §99) — fim das páginas de roteiro e de embarcação,
 * e prévia ao vivo do formulário do painel e da revisão do admin.
 *
 * Apresentacional: sem imports de servidor (as views de detalhe são compartilhadas com a
 * pré-visualização do painel). O que muda de um contexto para outro entra por `acao` (ex.:
 * botão do chat) e por `linkPerfil` (some na prévia).
 */
export default function OperadorSecao({
  operador,
  acao,
  linkPerfil = true,
  className = '',
}: {
  operador: OperadorPublico;
  /** Botão principal (conversar com o operador); ausente = sem botão. */
  acao?: ReactNode;
  /** "Ver perfil completo" → /operadores/[id]. Falso na prévia e na própria página do operador. */
  linkPerfil?: boolean;
  className?: string;
}) {
  const t = useTranslations('Operador');
  const f = useFormatos();
  const idTitulo = useId();
  const idBio = useId();
  const [aberta, setAberta] = useState(false);

  const longa = operador.bio.length > LIMITE_RECOLHIDA;
  const metricas: { chave: string; valor: ReactNode; rotulo: string }[] = [
    operador.media !== null
      ? {
          chave: 'media',
          valor: (
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-5 w-5 fill-destaque text-destaque" aria-hidden />
              {f.numero(operador.media, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          ),
          rotulo: t('avaliacoes', { count: operador.totalAvaliacoes }),
        }
      : {
          chave: 'media',
          valor: (
            <span className="inline-flex items-center rounded-full bg-turquesa/10 px-2.5 py-0.5 text-sm font-semibold text-turquesa-escuro">
              {t('novo')}
            </span>
          ),
          rotulo: t('semAvaliacoes'),
        },
  ];
  if (operador.experiencias > 0) {
    metricas.push({
      chave: 'experiencias',
      valor: f.numero(operador.experiencias),
      rotulo: operador.experiencias === 1 ? t('metricaExperiencia') : t('metricaExperiencias'),
    });
  }
  if (operador.passeiosRealizados > 0) {
    metricas.push({
      chave: 'passeios',
      valor: f.numero(operador.passeiosRealizados),
      rotulo: operador.passeiosRealizados === 1 ? t('metricaPasseio') : t('metricaPasseios'),
    });
  }

  return (
    <section
      id="operador"
      aria-labelledby={idTitulo}
      className={`relative overflow-hidden rounded-3xl border border-slate-100 bg-areia ${className}`}
    >
      {/* Ondas: assinatura discreta do mar, sem peso de imagem. */}
      <svg
        aria-hidden
        viewBox="0 0 480 120"
        fill="none"
        className="pointer-events-none absolute -right-16 -top-4 h-28 w-[30rem] text-turquesa/20 sm:-right-6"
      >
        <path d="M0 70c40-40 80-40 120 0s80 40 120 0 80-40 120 0 80 40 120 0" stroke="currentColor" strokeWidth="2" />
        <path d="M0 96c40-40 80-40 120 0s80 40 120 0 80-40 120 0 80 40 120 0" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      </svg>

      <div className="relative grid gap-8 p-5 sm:p-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:p-10">
        {/* Retrato */}
        <div className="relative self-start pb-3 pr-3 md:pb-3">
          <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl border-2 border-turquesa/30" />
          <div className="relative aspect-[16/11] overflow-hidden rounded-3xl bg-slate-200 shadow-lg shadow-marinho/10 md:aspect-[4/5]">
            <Image
              src={operador.fotoUrl}
              alt={t('fotoAlt', { nome: operador.nome })}
              fill
              sizes="(min-width: 1024px) 272px, (min-width: 768px) 240px, 100vw"
              className="object-cover object-[50%_22%]"
              unoptimized
            />
          </div>
          <span className="absolute bottom-0 left-4 inline-flex translate-y-1/2 items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-marinho shadow-md ring-1 ring-slate-100 md:left-5">
            {t('membroDesde', { ano: operador.desdeAno })}
          </span>
        </div>

        {/* Texto */}
        <div className="flex min-w-0 max-w-3xl flex-col pt-3 md:pt-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-turquesa-escuro">{t('eyebrow')}</p>
          <h2 id={idTitulo} className="mt-2 text-2xl font-bold tracking-tight text-marinho sm:text-3xl">
            {t.rich('titulo', {
              nome: operador.primeiroNome,
              // t.rich devolve uma lista de trechos: o elemento precisa de key.
              destaque: (nome) => (
                <span key="nome" className="bg-gradient-to-r from-marinho to-turquesa bg-clip-text text-transparent">{nome}</span>
              ),
            })}
          </h2>
          {operador.headline && (
            <p className="mt-2 text-base font-medium italic leading-snug text-slate-600">{operador.headline}</p>
          )}

          <div className="mt-4">
            <p
              id={idBio}
              className={`text-[15px] leading-relaxed text-slate-600 ${longa && !aberta ? 'line-clamp-5' : 'whitespace-pre-line'}`}
            >
              {operador.bio}
            </p>
            {longa && (
              <button
                type="button"
                onClick={() => setAberta((v) => !v)}
                aria-expanded={aberta}
                aria-controls={idBio}
                className="mt-1.5 rounded text-sm font-semibold text-marinho underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa"
              >
                {aberta ? t('lerMenos') : t('lerMais')}
              </button>
            )}
          </div>

          <dl
            className="mt-6 grid divide-x divide-slate-200/80 rounded-2xl bg-white/80 py-4 ring-1 ring-slate-100"
            style={{ gridTemplateColumns: `repeat(${metricas.length}, minmax(0, 1fr))` }}
          >
            {metricas.map((m) => (
              <div key={m.chave} className="flex min-w-0 flex-col gap-1.5 px-3 text-left sm:px-5">
                <dd className="order-1 text-2xl font-bold tabular-nums leading-none text-marinho">{m.valor}</dd>
                <dt className="order-2 text-xs font-medium leading-tight text-slate-500">{m.rotulo}</dt>
              </div>
            ))}
          </dl>

          {(acao || linkPerfil) && (
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* `acao` chega de um Server Component: sozinho no wrapper, não entra na validação de keys da lista de filhos. */}
              {acao && <div className="contents">{acao}</div>}
              {linkPerfil && (
                <Link
                  href={`/operadores/${operador.id}`}
                  className="group inline-flex items-center gap-1.5 rounded text-sm font-semibold text-marinho focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-turquesa"
                >
                  <span className="underline-offset-4 group-hover:underline">{t('verPerfil')}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
