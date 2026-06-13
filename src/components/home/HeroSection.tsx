'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import LocationPicker, { type LocationValue } from './search/LocationPicker';
import DatePicker, { type DateValue } from './search/DatePicker';
import GuestPicker from './search/GuestPicker';
import SearchTypeToggle, { type SearchType } from './search/SearchTypeToggle';

type ActivePanel = 'location' | 'date' | 'guests' | null;

const HERO_VIDEOS = ['/videos/hero01.mp4', '/videos/hero02.mp4', '/videos/hero03.mp4', '/videos/hero04.mp4'];

export default function HeroSection() {
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [date, setDate] = useState<DateValue | null>(null);
  const [guests, setGuests] = useState(0);
  const [searchType, setSearchType] = useState<SearchType>('roteiro');
  const [active, setActive] = useState<ActivePanel>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  useEffect(() => {
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

  function open(panel: ActivePanel) {
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
    const params = new URLSearchParams();
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
      params.set('data', date.date.toISOString().slice(0, 10));
      if (date.flexibility > 0) params.set('flex', String(date.flexibility));
    }
    if (guests > 0) params.set('pessoas', String(guests));

    const base = searchType === 'embarcacao' ? '/embarcacoes' : '/buscar';
    window.location.href = `${base}?${params.toString()}`;
  }

  return (
    <section className="relative z-10 h-[600px] md:h-[650px]" id="hero-section">
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B2447]/70 via-[#0B2447]/55 to-[#0B2447]/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        <p className="text-cyan-300 text-sm font-medium tracking-widest uppercase mb-3">
          Bem-vindo ao Boatzy
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight">
          O horizonte é{' '}
          <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
            seu
          </span>
          .
        </h1>
        <p className="text-slate-200 text-base md:text-lg max-w-xl mb-10 leading-relaxed">
          Explore embarcações pelo Brasil e encontre sua experiência perfeita no mar.
        </p>

        {/* Tipo de busca */}
        <div className="mb-3">
          <SearchTypeToggle value={searchType} onChange={setSearchType} variant="dark" />
        </div>

        {/* Search Bar */}
        <div
          ref={containerRef}
          className="bg-white rounded-2xl shadow-2xl p-2 w-full max-w-3xl"
          id="search-bar"
        >
          <div className="flex flex-col md:flex-row items-stretch gap-1">
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
                />
              )}
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
                className="bg-[#0B3D91] hover:bg-[#092E6E] text-white rounded-xl p-3.5 flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] cursor-pointer shrink-0 w-full md:w-auto"
                id="search-button"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
                <span className="font-semibold md:hidden">Buscar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
