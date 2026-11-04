'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MapPin, Users, Clock, Star, Sparkles, ArrowRight } from 'lucide-react';
import { useFormatos } from '@/i18n/formatos';
import { useCatalogo } from '@/i18n/CatalogoProvider';
import { hrefRoteiro, precoExibicaoRoteiro } from '@/lib/precos-roteiro';
import type { FeaturedRoteiroItem } from '../FeaturedRoteiros';

/**
 * Card imersivo da vitrine "mar" (opção A): foto em tela cheia, texto sobre
 * degradê marinho. Mesmos dados e mesmo destino do `RoteiroCard`.
 */
export default function CartaoVitrine({ roteiro, prioridade }: { roteiro: FeaturedRoteiroItem; prioridade?: boolean }) {
  const t = useTranslations('Cards');
  const f = useFormatos();
  const { traduzir } = useCatalogo();

  const img = (roteiro.roteiro_imagens.find((i) => i.principal) ?? roteiro.roteiro_imagens[0])?.url_imagem ?? null;
  const localidade = roteiro.municipios
    ? roteiro.municipios.estados
      ? `${roteiro.municipios.nome}, ${roteiro.municipios.estados.uf}`
      : roteiro.municipios.nome
    : null;
  const preco = precoExibicaoRoteiro(roteiro);
  const duracao = f.duracao(roteiro.duracao_horas) ?? roteiro.duracao;
  const tipo = roteiro.embarcacao?.embarcacao_tipo?.nome;

  return (
    <Link
      href={hrefRoteiro(roteiro.id)}
      className="group relative block h-[25rem] md:h-[28rem] overflow-hidden rounded-3xl bg-marinho-escuro ring-1 ring-white/10 shadow-xl shadow-black/30 transition-transform duration-500 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turquesa"
    >
      {img ? (
        // A animação de entrada (zoom que assenta) fica no wrapper: na própria
        // imagem, o `fill-mode` travaria o zoom do hover.
        <div className="vitrine-card-foto absolute inset-0">
        <Image
          src={img}
          alt={roteiro.nome}
          fill
          priority={prioridade}
          sizes="(max-width: 640px) 86vw, (max-width: 1024px) 48vw, 33vw"
          className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
        />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <MapPin className="h-10 w-10 text-white/20" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-marinho via-marinho/70 via-35% to-transparent to-75%" />
      <div aria-hidden className="vitrine-card-brilho pointer-events-none absolute inset-0" />

      {/* Selo: nota (com avaliações) ou "Novo" */}
      <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-marinho shadow-sm">
        {roteiro.total > 0 ? (
          <>
            <Star className="h-3 w-3 fill-destaque text-destaque" />
            {f.numero(roteiro.media, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <span className="font-normal text-slate-500">({roteiro.total})</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3 text-turquesa-escuro" />
            {t('novo')}
          </>
        )}
      </span>

      <div className="vitrine-card-texto absolute inset-x-0 bottom-0 p-4 md:p-5 text-left">
        {localidade && (
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-white/85">
            <MapPin aria-hidden className="h-3 w-3 text-turquesa" />
            {localidade}
          </p>
        )}
        <h3 className="text-xl font-semibold leading-snug text-white line-clamp-2">{roteiro.nome}</h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
          {tipo && <span>{traduzir('tipo', tipo)}</span>}
          {roteiro.quantidade_pessoas && (
            <span className="flex items-center gap-1">
              <Users aria-hidden className="h-3 w-3" />
              {f.pessoas(roteiro.quantidade_pessoas)}
            </span>
          )}
          {duracao && (
            <span className="flex items-center gap-1">
              <Clock aria-hidden className="h-3 w-3" />
              {duracao}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end justify-between border-t border-white/15 pt-3">
          {preco ? (
            <div className="leading-tight">
              <span className="block text-[9px] uppercase tracking-wide text-white/50">{f.rotuloPreco(preco)}</span>
              <span className="text-base font-bold text-white">{f.preco(preco.valor)}</span>
              <span className="ml-1 text-xs text-white/60">{f.unidadePreco(preco.modelo)}</span>
            </div>
          ) : (
            <span className="text-xs italic text-white/60">{t('consultePreco')}</span>
          )}
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-all duration-300 group-hover:bg-turquesa group-hover:ring-turquesa"
          >
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
