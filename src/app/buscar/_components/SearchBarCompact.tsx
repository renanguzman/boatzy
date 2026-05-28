'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import LocationPicker, { type LocationValue } from '@/components/home/search/LocationPicker';
import DatePicker, { type DateValue } from '@/components/home/search/DatePicker';
import GuestPicker from '@/components/home/search/GuestPicker';

type ActivePanel = 'location' | 'date' | 'guests' | null;

type Props = {
  initialLocation?: { id: number; nome: string; uf: string } | null;
  initialDate?: { date: string; flex: number } | null;
  initialGuests?: number;
};

export default function SearchBarCompact({ initialLocation, initialDate, initialGuests = 0 }: Props) {
  const router = useRouter();

  const [location, setLocation] = useState<LocationValue | null>(
    initialLocation ? { type: 'place', ...initialLocation } : null,
  );
  const [date, setDate] = useState<DateValue | null>(
    initialDate
      ? { date: new Date(initialDate.date + 'T12:00:00'), flexibility: initialDate.flex as DateValue['flexibility'] }
      : null,
  );
  const [guests, setGuests] = useState(initialGuests);
  const [active, setActive] = useState<ActivePanel>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    router.push(`/buscar?${params.toString()}`);
    setActive(null);
  }

  return (
    <div
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-2xl shadow-sm px-1 py-1 flex items-center gap-1 w-full max-w-2xl"
    >
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
              compact
            />
            <button
              type="button"
              onClick={() => { setLocation(null); open('location'); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="h-3 w-3 text-slate-500" />
            </button>
          </div>
        ) : (
          <LocationPicker
            value={null}
            onChange={setLocation}
            isOpen={active === 'location'}
            onOpen={() => open('location')}
            onClose={() => setActive(null)}
            compact
          />
        )}
      </div>

      <div className="w-px h-6 bg-slate-200 shrink-0" />

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
              compact
            />
            <button
              type="button"
              onClick={() => setDate(null)}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="h-3 w-3 text-slate-500" />
            </button>
          </div>
        ) : (
          <DatePicker
            value={null}
            onChange={setDate}
            isOpen={active === 'date'}
            onOpen={() => open('date')}
            onClose={() => setActive(null)}
            compact
          />
        )}
      </div>

      <div className="w-px h-6 bg-slate-200 shrink-0" />

      {/* Guests + Search */}
      <div className="flex items-center gap-1 shrink-0">
        <GuestPicker
          value={guests}
          onChange={setGuests}
          isOpen={active === 'guests'}
          onOpen={() => open('guests')}
          onClose={() => setActive(null)}
          compact
        />
        <button
          type="button"
          onClick={handleSearch}
          className="bg-[#0B3D91] hover:bg-[#092E6E] text-white rounded-xl p-2.5 flex items-center justify-center transition-all hover:shadow-md hover:scale-[1.04] active:scale-[0.97] cursor-pointer"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
