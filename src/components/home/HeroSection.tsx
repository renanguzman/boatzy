'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Search, MapPin, Calendar, Users } from 'lucide-react';

export default function HeroSection() {
  const [location, setLocation] = useState('');
  const [dates, setDates] = useState('');
  const [guests, setGuests] = useState('');

  return (
    <section className="relative h-[600px] md:h-[650px] overflow-hidden" id="hero-section">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-yacht.png"
          alt="Luxury yacht sailing at sunset"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B2447]/60 via-[#0B2447]/40 to-[#0B2447]/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        <p className="text-cyan-300 text-sm font-medium tracking-widest uppercase mb-3 animate-fade-in">
          Bem-vindo ao Boatzy
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight">
          The Horizon is{' '}
          <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
            Yours
          </span>
          .
        </h1>
        <p className="text-slate-200 text-base md:text-lg max-w-xl mb-10 leading-relaxed">
          Explore embarcações de luxo pelo Brasil e encontre sua experiência perfeita no mar.
        </p>

        {/* Search Bar */}
        <div
          className="bg-white rounded-2xl shadow-2xl p-2 w-full max-w-3xl flex flex-col md:flex-row gap-2"
          id="search-bar"
        >
          {/* Location */}
          <div className="flex items-center gap-3 flex-1 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors">
            <MapPin className="h-5 w-5 text-[#0B3D91] shrink-0" />
            <div className="flex flex-col text-left w-full">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Destino
              </label>
              <input
                type="text"
                placeholder="Para onde?"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400 w-full"
                id="search-location"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px bg-slate-200 my-2" />

          {/* Dates */}
          <div className="flex items-center gap-3 flex-1 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors">
            <Calendar className="h-5 w-5 text-[#0B3D91] shrink-0" />
            <div className="flex flex-col text-left w-full">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Check-in / Check-out
              </label>
              <input
                type="text"
                placeholder="Adicione datas"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                className="text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400 w-full"
                id="search-dates"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px bg-slate-200 my-2" />

          {/* Guests */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors">
            <Users className="h-5 w-5 text-[#0B3D91] shrink-0" />
            <div className="flex flex-col text-left">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Hóspedes
              </label>
              <input
                type="text"
                placeholder="Quantos?"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="text-sm text-slate-800 bg-transparent outline-none placeholder:text-slate-400 w-24"
                id="search-guests"
              />
            </div>
          </div>

          {/* Search Button */}
          <button
            className="bg-[#0B3D91] hover:bg-[#092E6E] text-white rounded-xl px-6 py-3 flex items-center justify-center gap-2 font-medium transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            id="search-button"
          >
            <Search className="h-5 w-5" />
            <span className="md:hidden">Buscar</span>
          </button>
        </div>
      </div>
    </section>
  );
}
