'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Search, X, Compass, ChevronRight, Ship, CreditCard } from 'lucide-react';
import LocationPicker, { type LocationValue } from './search/LocationPicker';
import DatePicker, { type DateValue } from './search/DatePicker';
import GuestPicker from './search/GuestPicker';
import SearchTypeToggle, { type SearchType } from './search/SearchTypeToggle';
import TipoEmbarcacaoPicker, { type TipoEmbarcacaoValue } from './search/TipoEmbarcacaoPicker';
import TipoVendaPicker, { type TipoVendaOption } from './search/venda/TipoVendaPicker';
import LocalidadeVendaPicker, { type LocalVendaOption, type LocalidadeVendaValue } from './search/venda/LocalidadeVendaPicker';
import AnoVendaPicker, { type AnoVendaValue } from './search/venda/AnoVendaPicker';
import ValorVendaPicker, { type ValorVendaValue } from './search/venda/ValorVendaPicker';
import { buildVendaSearchUrl } from './search/venda/build-url';

type ActivePanel = 'location' | 'date' | 'guests' | 'tipo' | 'tipo_venda' | 'localidade' | 'ano' | 'valor' | null;

const HERO_VIDEOS = ['/videos/hero02.mp4', '/videos/hero03.mp4', '/videos/hero04.mp4'];

// Instrução mínima para quem chega pela primeira vez: o caminho até a reserva.
const PASSOS = [
  { icon: Search, texto: 'Busque o destino' },
  { icon: Ship, texto: 'Escolha o roteiro' },
  { icon: CreditCard, texto: 'Reserve e pague online' },
];

type Props = {
  tiposEmbarcacao: TipoEmbarcacaoValue[];
  tiposVenda: TipoVendaOption[];
  locaisVenda: LocalVendaOption[];
};

export default function HeroSection({ tiposEmbarcacao, tiposVenda, locaisVenda }: Props) {
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [date, setDate] = useState<DateValue | null>(null);
  const [guests, setGuests] = useState(0);
  const [tipoEmbarcacao, setTipoEmbarcacao] = useState<TipoEmbarcacaoValue | null>(null);
  const [searchType, setSearchType] = useState<SearchType>('roteiro');
  const [active, setActive] = useState<ActivePanel>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtros da aba Vendas (tipo obrigatório; demais opcionais).
  const [tipoVenda, setTipoVenda] = useState<TipoVendaOption | null>(null);
  const [localidadeVenda, setLocalidadeVenda] = useState<LocalidadeVendaValue | null>(null);
  const [anoVenda, setAnoVenda] = useState<AnoVendaValue>({ min: '', max: '' });
  const [valorVenda, setValorVenda] = useState<ValorVendaValue>({ min: '', max: '' });

  const [videoReady, setVideoReady] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  useEffect(() => {
    // Seleção aleatória só no cliente, após a montagem, para evitar mismatch de
    // hidratação (o SSR renderiza sem o <video>; o cliente escolhe o vídeo aqui).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoSrc(HERO_VIDEOS[Math.floor(Math.random() * HERO_VIDEOS.length)]);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Balão "Comece sua experiência por aqui" sob o campo Destino: entra pouco
  // depois de a página abrir e some sozinho em 15 s — ou antes, se a pessoa
  // interagir com a busca.
  const [dicaDestino, setDicaDestino] = useState(false);
  useEffect(() => {
    const entrar = setTimeout(() => setDicaDestino(true), 700);
    const sair = setTimeout(() => setDicaDestino(false), 700 + 15000);
    return () => {
      clearTimeout(entrar);
      clearTimeout(sair);
    };
  }, []);

  function open(panel: ActivePanel) {
    setDicaDestino(false);
    setActive((prev) => (prev === panel ? null : panel));
  }

  function clearLocation() {
    setLocation(null);
    setActive('location');
  }

  function clearDate() {
    setDate(null);
  }

  function handleSearch() {
    // A aba Vendas tem filtros e destino próprios (/vendas); tipo é obrigatório.
    if (searchType === 'venda') {
      if (!tipoVenda) {
        setActive('tipo_venda');
        return;
      }
      window.location.href = buildVendaSearchUrl({
        tipo: tipoVenda,
        localidade: localidadeVenda,
        ano: anoVenda,
        valor: valorVenda,
      });
      return;
    }

    const params = new URLSearchParams();
    // A aba "Embarcações" leva a /buscar, que lista as embarcações que
    // atendem o critério (com foto); só depois de escolher uma é que os
    // roteiros dela aparecem (embarcacao_id, adicionado dentro de /buscar).
    if (searchType === 'embarcacao') {
      params.set('tipo', 'embarcacao');
      if (tipoEmbarcacao) {
        params.set('tipo_embarcacao', tipoEmbarcacao.id);
        params.set('tipo_nome', tipoEmbarcacao.nome);
      }
    }
    if (location) {
      if (location.type === 'place') {
        params.set('municipio', String(location.id));
        params.set('local', `${location.nome}, ${location.uf}`);
      } else {
        params.set('lat', String(location.lat));
        params.set('lng', String(location.lng));
      }
    }
    if (date) {
      const d = date.date; // meia-noite local do DatePicker — toISOString() poderia virar o dia
      params.set('data', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      if (date.flexibility > 0) params.set('flex', String(date.flexibility));
    }
    if (guests > 0) params.set('pessoas', String(guests));

    window.location.href = `/buscar?${params.toString()}`;
  }

  return (
    // Altura: no computador, 77% de (tela menos 8rem — header de 64px + uma
    // faixa do conteúdo seguinte à mostra), entre 416 e 493px. No celular a
    // busca empilhada não cabe em altura fixa: acompanha o conteúdo, mínimo 462px.
    <section className="relative z-10 min-h-[462px] md:h-[calc((100svh-8rem)*0.77)] md:min-h-[416px] md:max-h-[493px]" id="hero-section">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        {!videoReady && (
          <Image
            src="/images/hero-yacht.png"
            alt="Iate de luxo ao amanhecer"
            fill
            className="object-cover"
            priority
          />
        )}
        {videoSrc && <video
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setVideoReady(true)}
          className={`absolute inset-0 w-full h-full object-cover object-top scale-[1.2] origin-top transition-opacity duration-300 ${
            videoReady ? 'opacity-100' : 'opacity-0'
          }`}
        />}
        <div className="absolute inset-0 bg-gradient-to-b from-marinho/70 via-marinho/55 to-marinho/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[462px] py-8 md:min-h-0 md:h-full md:py-0 px-4 text-center">
        <p className="text-turquesa text-xs md:text-sm font-medium tracking-wider md:tracking-widest uppercase mb-2 md:mb-3">
          Passeios de barco com reserva 100% online
        </p>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 tracking-tight">
          O horizonte é{' '}
          <span className="text-destaque">seu</span>
          .
        </h1>
        <p className="text-slate-200 text-sm md:text-lg max-w-xl mb-6 leading-relaxed">
          Do roteiro ao embarque — faça tudo pelo site, com pagamento seguro, em poucos minutos.
        </p>

        {/* Tipo de busca */}
        <div className="mb-3">
          <SearchTypeToggle value={searchType} onChange={setSearchType} variant="dark" showVendas={false} />
        </div>

        {/* Search Bar */}
        <div
          ref={containerRef}
          className="bg-white rounded-2xl shadow-2xl p-2 w-full max-w-3xl"
          id="search-bar"
        >
          <div className="flex flex-col md:flex-row items-stretch gap-1">
            {searchType === 'venda' ? (
              <>
                {/* Tipo (obrigatório) */}
                <div className="flex-1 relative min-w-0">
                  <TipoVendaPicker
                    options={tiposVenda}
                    value={tipoVenda}
                    onChange={setTipoVenda}
                    isOpen={active === 'tipo_venda'}
                    onOpen={() => open('tipo_venda')}
                    onClose={() => setActive(null)}
                  />
                </div>

                <div className="hidden md:block w-px bg-slate-200 my-2 shrink-0" />

                {/* Localidade (estado → cidade, opcional) */}
                <div className="flex-1 relative min-w-0">
                  <LocalidadeVendaPicker
                    options={locaisVenda}
                    value={localidadeVenda}
                    onChange={setLocalidadeVenda}
                    isOpen={active === 'localidade'}
                    onOpen={() => open('localidade')}
                    onClose={() => setActive(null)}
                  />
                  {localidadeVenda && (
                    <button
                      type="button"
                      onClick={() => setLocalidadeVenda(null)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  )}
                </div>

                <div className="hidden md:block w-px bg-slate-200 my-2 shrink-0" />

                {/* Ano (opcional) */}
                <div className="flex-1 relative min-w-0">
                  <AnoVendaPicker
                    value={anoVenda}
                    onChange={setAnoVenda}
                    isOpen={active === 'ano'}
                    onOpen={() => open('ano')}
                    onClose={() => setActive(null)}
                  />
                </div>

                <div className="hidden md:block w-px bg-slate-200 my-2 shrink-0" />

                {/* Valor (opcional) */}
                <div className="flex-1 relative min-w-0">
                  <ValorVendaPicker
                    value={valorVenda}
                    onChange={setValorVenda}
                    isOpen={active === 'valor'}
                    onOpen={() => open('valor')}
                    onClose={() => setActive(null)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSearch}
                  className="bg-marinho hover:bg-marinho-escuro text-white rounded-xl p-3.5 flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] cursor-pointer shrink-0 w-full md:w-auto"
                  aria-label="Buscar embarcações à venda"
                >
                  <Search className="h-5 w-5" />
                  <span className="font-semibold md:hidden">Buscar</span>
                </button>
              </>
            ) : (
              <>
            {/* Tipo de embarcação (apenas na busca por embarcação) */}
            {searchType === 'embarcacao' && (
              <>
                <div className="flex-1 relative min-w-0">
                  <TipoEmbarcacaoPicker
                    options={tiposEmbarcacao}
                    value={tipoEmbarcacao}
                    onChange={setTipoEmbarcacao}
                    isOpen={active === 'tipo'}
                    onOpen={() => open('tipo')}
                    onClose={() => setActive(null)}
                  />
                  {tipoEmbarcacao && (
                    <button
                      type="button"
                      onClick={() => setTipoEmbarcacao(null)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 my-2 shrink-0" />
              </>
            )}

            {/* Location */}
            <div className="flex-1 relative min-w-0">
              {location ? (
                <div className="relative">
                  <LocationPicker
                    value={location}
                    onChange={setLocation}
                    isOpen={active === 'location'}
                    onOpen={() => open('location')}
                    onClose={() => setActive(null)}
                    buscarRoteiros={searchType === 'roteiro'}
                  />
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                </div>
              ) : (
                <LocationPicker
                  value={null}
                  onChange={setLocation}
                  isOpen={active === 'location'}
                  onOpen={() => open('location')}
                  onClose={() => setActive(null)}
                  buscarRoteiros={searchType === 'roteiro'}
                />
              )}

              {/* Balão de boas-vindas apontando para o Destino (some em 15 s) */}
              <div
                aria-hidden={!dicaDestino}
                className={`pointer-events-none absolute left-3 top-full z-40 mt-3 transition-all duration-500 ease-out ${
                  dicaDestino && active !== 'location' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                }`}
              >
                <span className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 rounded-[2px] bg-black/70 backdrop-blur-md" />
                <div className="relative flex items-center gap-2 whitespace-nowrap rounded-xl bg-black/70 backdrop-blur-md px-3.5 py-2.5 text-xs font-medium tracking-wide text-white shadow-xl shadow-black/40 ring-1 ring-white/10">
                  <Compass className="h-3.5 w-3.5 text-white/80" strokeWidth={1.5} />
                  Comece sua experiência por aqui
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-slate-200 my-2 shrink-0" />

            {/* Date */}
            <div className="flex-1 relative min-w-0">
              {date ? (
                <div className="relative">
                  <DatePicker
                    value={date}
                    onChange={setDate}
                    isOpen={active === 'date'}
                    onOpen={() => open('date')}
                    onClose={() => setActive(null)}
                  />
                  <button
                    type="button"
                    onClick={clearDate}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                </div>
              ) : (
                <DatePicker
                  value={null}
                  onChange={setDate}
                  isOpen={active === 'date'}
                  onOpen={() => open('date')}
                  onClose={() => setActive(null)}
                />
              )}
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-slate-200 my-2 shrink-0" />

            {/* Guests + Search button */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-1">
              <div className="flex-1 min-w-0">
                <GuestPicker
                  value={guests}
                  onChange={setGuests}
                  isOpen={active === 'guests'}
                  onOpen={() => open('guests')}
                  onClose={() => setActive(null)}
                  inline
                />
              </div>

              <button
                type="button"
                onClick={handleSearch}
                className="bg-marinho hover:bg-marinho-escuro text-white rounded-xl p-3.5 flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] cursor-pointer shrink-0 w-full md:w-auto"
                id="search-button"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
                <span className="font-semibold md:hidden">Buscar</span>
              </button>
            </div>
              </>
            )}
          </div>
        </div>

        {/* Como funciona, em uma linha */}
        <ol className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs md:text-sm text-white/80">
          {PASSOS.map(({ icon: Icone, texto }, i) => (
            <li key={texto} className="flex items-center gap-3">
              {i > 0 && <ChevronRight aria-hidden className="hidden sm:block h-3.5 w-3.5 text-white/40" />}
              <span className="flex items-center gap-1.5">
                <Icone aria-hidden className="h-3.5 w-3.5 md:h-4 md:w-4 text-turquesa" />
                {texto}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
