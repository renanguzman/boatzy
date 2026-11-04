'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Compass } from 'lucide-react';
import RoteiroCard from '@/app/buscar/_components/RoteiroCard';
import { useCatalogo } from '@/i18n/CatalogoProvider';
import { rastrear } from '@/lib/analytics';
import type { FeaturedRoteiroItem } from '../FeaturedRoteiros';
import BuscaDiscreta from './BuscaDiscreta';
import CartaoVitrine from './CartaoVitrine';
import { cidadesDeSaida, filtrarRoteiros } from './filtrar';

const HERO_VIDEOS = ['/videos/hero02.mp4', '/videos/hero03.mp4', '/videos/hero04.mp4'];

/** Intervalo entre a entrada de um card e o próximo (efeito cascata). */
const PASSO_CASCATA_MS = 70;

export type VarianteVitrine = 'mar' | 'areia';

/**
 * Hero "vitrine" da home: mostra TODOS os passeios ativos logo na entrada, com
 * uma busca discreta que só filtra a lista (nunca leva a uma tela vazia).
 * Substitui o `HeroSection` (busca completa, guardada para quando houver mais
 * passeios — ver `HERO_PADRAO` em `src/app/page.tsx`).
 *
 * - `mar` (opção A): vídeo de fundo atrás de tudo, cards imersivos em vidro.
 * - `areia` (opção B): faixa de vídeo curta no topo; os cards do site
 *   (`RoteiroCard`) "emergem" dela sobre o fundo areia.
 */
export default function HeroVitrine({
  roteiros,
  variante,
}: {
  roteiros: FeaturedRoteiroItem[];
  variante: VarianteVitrine;
}) {
  const t = useTranslations('Hero');
  const { traduzir } = useCatalogo();
  const [termo, setTermo] = useState('');
  const mar = variante === 'mar';

  const filtrados = useMemo(
    () => filtrarRoteiros(roteiros, termo, (nome) => traduzir('tipo', nome)),
    [roteiros, termo, traduzir],
  );
  const termoLimpo = termo.trim();
  const semResultado = termoLimpo.length > 0 && filtrados.length === 0;
  // Sem resultado, a vitrine continua cheia: o usuário nunca fica sem opção.
  const exibidos = semResultado ? roteiros : filtrados;
  const cidades = useMemo(() => cidadesDeSaida(roteiros), [roteiros]);

  // Termos procurados (com e sem resultado) → GA4, para saber que destinos a
  // demanda pede antes de existirem passeios lá.
  useEffect(() => {
    if (termoLimpo.length < 3) return;
    const id = setTimeout(() => {
      rastrear('busca_vitrine_home', { termo: termoLimpo.toLowerCase(), resultados: filtrados.length, variante });
    }, 1200);
    return () => clearTimeout(id);
  }, [termoLimpo, filtrados.length, variante]);

  // Vídeo sorteado só no cliente (mesmo motivo do HeroSection: hidratação).
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoPronto, setVideoPronto] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoSrc(HERO_VIDEOS[Math.floor(Math.random() * HERO_VIDEOS.length)]);
  }, []);

  const { scrollerRef, podeVoltar, podeAvancar, rolar } = useCarrossel(exibidos.length);

  function buscar(valor: string) {
    setTermo(valor);
    // Lista nova começa do primeiro card.
    scrollerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }

  const fundo = (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {!videoPronto && <Image src="/images/hero-yacht.png" alt="" fill priority className="object-cover" />}
      {videoSrc && (
        <video
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setVideoPronto(true)}
          className={`absolute inset-0 h-full w-full object-cover object-top scale-[1.2] origin-top transition-opacity duration-700 ${
            videoPronto ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      <div
        className={
          mar
            ? 'absolute inset-0 bg-gradient-to-b from-marinho/75 via-marinho/60 to-marinho'
            : 'absolute inset-0 bg-gradient-to-b from-marinho/70 via-marinho/55 to-marinho/85'
        }
      />
    </div>
  );

  const contagem = termoLimpo && !semResultado
    ? t('vitrine.resultados', { count: filtrados.length, termo: termoLimpo })
    : t('vitrine.disponiveis', { count: roteiros.length });

  const barra = (
    <div className="vitrine-surge flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: '240ms' }}>
      <div className={`flex min-h-[2.5rem] items-center text-sm ${mar ? 'text-white/80' : 'text-slate-600'}`} aria-live="polite">
        {semResultado ? (
          <p key="sem" className="vitrine-surge flex items-start gap-2">
            <Compass aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${mar ? 'text-turquesa' : 'text-turquesa-escuro'}`} />
            <span>
              <strong className={`font-semibold ${mar ? 'text-white' : 'text-marinho'}`}>
                {t('vitrine.semResultadoTitulo', { termo: termoLimpo })}
              </strong>{' '}
              {t('vitrine.semResultadoTexto')}
            </span>
          </p>
        ) : (
          <p key="ok" className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={`font-semibold ${mar ? 'text-white' : 'text-marinho'}`}>{contagem}</span>
            {!termoLimpo && cidades.length > 0 && cidades.length <= 3 && (
              <span className="flex items-center gap-1">
                <span aria-hidden className={mar ? 'text-white/40' : 'text-slate-300'}>·</span>
                <MapPin aria-hidden className={`h-3.5 w-3.5 ${mar ? 'text-turquesa' : 'text-turquesa-escuro'}`} />
                {t('vitrine.saidas', { locais: cidades.join(' · ') })}
              </span>
            )}
          </p>
        )}
      </div>
      <BuscaDiscreta valor={termo} onChange={buscar} tom={mar ? 'escuro' : 'claro'} />
    </div>
  );

  const setas = exibidos.length > 1 && (
    <div className="hidden lg:flex items-center gap-2">
      {(['voltar', 'avancar'] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => rolar(dir)}
          disabled={dir === 'voltar' ? !podeVoltar : !podeAvancar}
          aria-label={t(dir === 'voltar' ? 'vitrine.anterior' : 'vitrine.proximo')}
          className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none ${
            mar
              ? 'text-white ring-1 ring-white/25 hover:bg-white/10'
              : 'text-slate-600 border border-slate-200 bg-white hover:shadow-sm'
          }`}
        >
          {dir === 'voltar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ))}
    </div>
  );

  const carrossel = (
    <div
      ref={scrollerRef}
      className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-4 overflow-x-auto px-4 pb-4 pt-1 scrollbar-hide sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:scroll-pl-0 lg:px-0"
    >
      {exibidos.map((r, i) => (
        // `key` só pelo id: card que continua no filtro não reanima; o que volta, sim.
        <div
          key={r.id}
          className="vitrine-card w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-[calc((100%-3rem)/4)]"
          style={{ '--atraso': `${280 + i * PASSO_CASCATA_MS}ms` } as React.CSSProperties}
        >
          {mar ? (
            <CartaoVitrine roteiro={r} prioridade={i < 2} />
          ) : (
            <RoteiroCard
              roteiro={r}
              initialFavorito={r.favorito}
              avaliacaoResumo={r.total > 0 ? { media: r.media, total: r.total } : null}
            />
          )}
        </div>
      ))}
    </div>
  );

  const titulo = (
    <>
      <p className="vitrine-surge mb-2 text-xs md:text-sm font-medium uppercase tracking-wider md:tracking-widest text-turquesa">
        {t('sobretitulo')}
      </p>
      <h1
        className="vitrine-surge mb-2 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
        style={{ animationDelay: '80ms' }}
      >
        {t.rich('titulo', { destaque: (texto) => <span className="text-destaque">{texto}</span> })}
      </h1>
      <p
        className="vitrine-surge max-w-xl text-sm md:text-base leading-relaxed text-slate-200"
        style={{ animationDelay: '160ms' }}
      >
        {t('vitrine.subtitulo')}
      </p>
    </>
  );

  // Pílula com o gradiente oficial (marinho → turquesa) na borda e a seta num
  // círculo turquesa; no hover, o gradiente preenche a pílula.
  const verTodos = (
    <Link
      href="/buscar"
      className={`vitrine-surge group relative inline-flex items-center gap-2.5 rounded-full p-px bg-gradient-to-r from-turquesa/70 to-turquesa/20 shadow-lg transition-shadow duration-300 hover:shadow-turquesa/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turquesa ${
        mar ? 'shadow-black/20' : 'shadow-marinho/10'
      }`}
      style={{ animationDelay: `${280 + Math.min(exibidos.length, 4) * PASSO_CASCATA_MS + 200}ms` }}
    >
      <span
        className={`inline-flex items-center gap-2.5 rounded-full py-1.5 pl-4 pr-1.5 text-sm font-semibold transition-colors duration-300 group-hover:bg-gradient-to-r group-hover:from-marinho group-hover:to-turquesa group-hover:text-white ${
          mar ? 'bg-marinho/80 text-white backdrop-blur-md' : 'bg-white text-marinho'
        }`}
      >
        {t('vitrine.verTodos')}
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-turquesa text-marinho transition-colors duration-300 group-hover:bg-white"
        >
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );

  if (mar) {
    return (
      <section className="relative z-10 overflow-hidden bg-marinho" id="hero-section">
        {fundo}
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-8 sm:px-6 md:pt-14 lg:px-8">
          <div className="mb-6 md:mb-8">{titulo}</div>
          <div className="mb-4">{barra}</div>
          {carrossel}
          <div className="mt-2 flex items-center justify-between">
            {verTodos}
            {setas}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-10 bg-areia" id="hero-section">
      <div className="relative overflow-hidden">
        {fundo}
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-28 text-center sm:px-6 md:pt-14 md:pb-32 lg:px-8 flex flex-col items-center">
          {titulo}
        </div>
      </div>
      <div className="relative mx-auto -mt-20 max-w-7xl px-4 pb-8 sm:px-6 md:-mt-24 lg:px-8">
        <div className="mb-4 rounded-2xl bg-white/95 p-3 shadow-lg shadow-marinho/10 ring-1 ring-slate-100 backdrop-blur-md sm:px-4 vitrine-surge" style={{ animationDelay: '200ms' }}>
          {barra}
        </div>
        {carrossel}
        <div className="mt-2 flex items-center justify-between">
          {verTodos}
          {setas}
        </div>
      </div>
    </section>
  );
}

function useCarrossel(quantidade: number) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const atualizar = () => {
      setPodeVoltar(el.scrollLeft > 4);
      setPodeAvancar(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    atualizar();
    el.addEventListener('scroll', atualizar, { passive: true });
    window.addEventListener('resize', atualizar);
    return () => {
      el.removeEventListener('scroll', atualizar);
      window.removeEventListener('resize', atualizar);
    };
  }, [quantidade]);

  function rolar(dir: 'voltar' | 'avancar') {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: (dir === 'voltar' ? -1 : 1) * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return { scrollerRef, podeVoltar, podeAvancar, rolar };
}
