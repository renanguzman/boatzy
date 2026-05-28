'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Clock } from 'lucide-react';
import type { LocalResult } from '@/app/api/buscar/locais/route';

export type LocationValue =
  | { type: 'geo'; lat: number; lng: number; label: string }
  | { type: 'place'; id: number; nome: string; uf: string };

type Props = {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  compact?: boolean;
};

const RECENT_KEY = 'boatzy_recent_locations';

function getRecent(): LocationValue[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecent(value: LocationValue) {
  try {
    const prev = getRecent().filter((r) =>
      r.type === 'geo'
        ? value.type !== 'geo'
        : value.type !== 'place' || r.id !== value.id,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify([value, ...prev].slice(0, 4)));
  } catch {
    // ignore
  }
}

function locationLabel(v: LocationValue) {
  return v.type === 'geo' ? v.label : `${v.nome}, ${v.uf}`;
}

export default function LocationPicker({ value, onChange, isOpen, onOpen, onClose, compact }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [recent, setRecent] = useState<LocationValue[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSuggestions([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/buscar/locais?q=${encodeURIComponent(query)}`);
        const data: LocalResult[] = await res.json();
        setSuggestions(data);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  function handleSelectPlace(r: LocalResult) {
    const v: LocationValue = { type: 'place', id: r.id, nome: r.nome, uf: r.uf };
    saveRecent(v);
    onChange(v);
    onClose();
  }

  function handleSelectRecent(v: LocationValue) {
    saveRecent(v);
    onChange(v);
    onClose();
  }

  async function handleGeo() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const res = await fetch(`/api/buscar/locais?lat=${lat}&lng=${lng}`);
          const data: LocalResult[] = await res.json();
          const nearest = data[0];
          const v: LocationValue = nearest
            ? { type: 'place', id: nearest.id, nome: nearest.nome, uf: nearest.uf }
            : { type: 'geo', lat, lng, label: 'Minha localização' };
          saveRecent(v);
          onChange(v);
          onClose();
        } finally {
          setGeoLoading(false);
        }
      },
      () => setGeoLoading(false),
    );
  }

  const showSuggestions = query.trim().length > 0;
  const showRecent = !showSuggestions && recent.length > 0;

  return (
    <div className="relative flex-1 min-w-0">
      {/* Field trigger */}
      <button
        type="button"
        onClick={onOpen}
        className={`w-full text-left rounded-2xl transition-all ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        } ${isOpen ? 'ring-2 ring-slate-800 bg-white shadow-md' : 'hover:bg-slate-50'}`}
      >
        <span className={`block font-bold text-slate-500 uppercase tracking-wider mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          Destino
        </span>
        {value ? (
          <span className={`font-medium text-slate-800 truncate block ${compact ? 'text-xs' : 'text-sm'}`}>
            {locationLabel(value)}
          </span>
        ) : (
          <span className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>Para onde?</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-100">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar destino..."
              className="flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 bg-transparent"
            />
            {loading && (
              <div className="h-4 w-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Near me */}
            <button
              type="button"
              onClick={handleGeo}
              disabled={geoLoading}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                {geoLoading ? (
                  <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 text-slate-600" />
                )}
              </div>
              <span className="text-sm font-medium text-slate-800">Próximo de mim</span>
            </button>

            {/* Recent searches */}
            {showRecent && (
              <>
                <div className="px-4 py-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Buscas recentes
                  </span>
                </div>
                {recent.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectRecent(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="text-sm text-slate-700">{locationLabel(r)}</span>
                  </button>
                ))}
              </>
            )}

            {/* Suggestions from API */}
            {showSuggestions && suggestions.length === 0 && !loading && (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">
                Nenhum destino encontrado
              </p>
            )}
            {showSuggestions &&
              suggestions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectPlace(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.nome}</p>
                    <p className="text-xs text-slate-500">{r.estado}</p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
